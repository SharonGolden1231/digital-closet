import { createHash } from "node:crypto";
import { getAdminClient } from "./_lib/gate.js";

// Public route: creates an account for someone holding a valid invite code.
// Sign-ups stay switched OFF in Supabase; only this route (using the server
// key) can create users, and only after the database has reserved a code and
// confirmed there is room under the release cap.

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/;
const MIN_PASSWORD = 10;
const MAX_PASSWORD = 72;

const GENERIC_FAIL = "That invite code can't be used. Check it and try again.";

function ipHash(req: any): string {
  const raw = String(
    req.headers?.["x-forwarded-for"] ?? req.socket?.remoteAddress ?? "unknown"
  )
    .split(",")[0]
    .trim();
  // Hash with a server-side salt so raw addresses are never stored.
  const salt = process.env.CRON_SECRET || "vestry";
  return createHash("sha256").update(`${salt}:${raw}`).digest("hex").slice(0, 32);
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const admin = getAdminClient();
  if (!admin) {
    console.error("redeem-invite: Supabase server settings are missing");
    return res.status(500).json({ error: "Service unavailable" });
  }

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const code = String(body.code ?? "").trim().toUpperCase();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!/^[A-HJ-NP-Z2-9]{10}$/.test(code)) {
    return res.status(400).json({ error: GENERIC_FAIL });
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }
  if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
    return res.status(400).json({
      error: `Choose a password of at least ${MIN_PASSWORD} characters.`,
    });
  }

  try {
    const { data: allowed, error: throttleError } = await admin.rpc(
      "invite_attempt_allowed",
      { p_ip_hash: ipHash(req) }
    );
    if (throttleError) {
      console.error("redeem-invite throttle failed:", throttleError.message);
      return res.status(500).json({ error: "Service unavailable" });
    }
    if (!allowed) {
      return res
        .status(429)
        .json({ error: "Too many attempts — try again in an hour." });
    }

    // Reserve the code (checks it exists, is unused, and that there is room).
    const { data: claim, error: claimError } = await admin.rpc("claim_invite", {
      p_code: code,
    });
    if (claimError) {
      console.error("redeem-invite claim failed:", claimError.message);
      return res.status(500).json({ error: "Service unavailable" });
    }
    if (claim === "full") {
      return res.status(409).json({
        error:
          "Vestry is opening in small batches and today's spots are taken. Your code stays valid — please try again soon.",
        code: "batch_full",
      });
    }
    if (claim !== "ok") {
      return res.status(400).json({ error: GENERIC_FAIL });
    }

    const { data: created, error: createError } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createError || !created?.user) {
      // Give the code back so the person can try again with another email.
      await admin.rpc("release_invite", { p_code: code });
      console.error("redeem-invite create failed:", createError?.message);
      return res.status(400).json({
        error: "That email can't be used. Try signing in instead.",
      });
    }

    const { error: finishError } = await admin.rpc("finish_invite", {
      p_code: code,
      p_user_id: created.user.id,
    });
    if (finishError) {
      // The account exists; the person can sign in. Their own invite codes
      // can be issued later by the founder. Do not leave the code claimed.
      console.error("redeem-invite finish failed:", finishError.message);
      await admin.rpc("release_invite", { p_code: code });
    }

    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("redeem-invite error:", error?.message);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
