import { createHash } from "node:crypto";
import { getAdminClient } from "./_lib/gate.js";

// Public route: join the waiting list. Always answers the same way for a valid
// request (whether or not the email already asked), so it reveals nothing.
// Bot protection: a hidden "website" field real people never fill in, a
// minimum time on the form, and at most 5 requests per network per hour.

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const PHONE_OS = ["iphone", "android", "other"];
const MIN_FORM_MS = 2500;

function ipHash(req: any): string {
  const raw = String(req.headers?.["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown")
    .split(",")[0]
    .trim();
  // Salted so raw addresses are never stored.
  const salt = process.env.CRON_SECRET || "vestry";
  return createHash("sha256").update(`waitlist:${salt}:${raw}`).digest("hex").slice(0, 32);
}

function clean(v: unknown, max: number): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") return null;
  const t = v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

export type Validated =
  | { ok: true; email: string; phoneOs: string | null; country: string | null; heardFrom: string | null; bot: boolean }
  | { ok: false; error: string };

export function validateRequest(body: any, now = Date.now()): Validated {
  const b = body && typeof body === "object" ? body : {};
  const email = String(b.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 254) return { ok: false, error: "Enter a valid email address." };
  const phoneOs = b.phone_os == null || b.phone_os === "" ? null : String(b.phone_os);
  if (phoneOs !== null && !PHONE_OS.includes(phoneOs)) return { ok: false, error: "Please choose your phone type." };
  const started = Number(b.started_at);
  const tooFast = !Number.isFinite(started) || now - started < MIN_FORM_MS;
  const honeypot = typeof b.website === "string" && b.website.trim() !== "";
  return {
    ok: true,
    email,
    phoneOs,
    country: clean(b.country, 60),
    heardFrom: clean(b.heard_from, 200),
    bot: tooFast || honeypot,
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const v = validateRequest(req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  // Bots get the normal answer and nothing is stored.
  if (v.bot) return res.status(200).json({ ok: true });

  const admin = getAdminClient();
  if (!admin) {
    console.error("request-access: Supabase server settings are missing");
    return res.status(500).json({ error: "Service unavailable" });
  }
  try {
    const { data, error } = await admin.rpc("submit_access_request", {
      p_email: v.email,
      p_phone_os: v.phoneOs,
      p_country: v.country,
      p_heard_from: v.heardFrom,
      p_ip_hash: ipHash(req),
    });
    if (error) {
      console.error("request-access failed:", error.message);
      return res.status(500).json({ error: "Couldn't send your request — please try again." });
    }
    if (data === "limited") {
      return res.status(429).json({ error: "Too many requests — please try again in an hour." });
    }
    return res.status(200).json({ ok: true });
  } catch (e: any) {
    console.error("request-access error:", e?.message);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
