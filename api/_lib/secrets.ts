import { createHmac, timingSafeEqual } from "node:crypto";

// Shared secret checks for the founder/cron routes (purge, admin-cap) and the
// keyed hash used for consent proof. Values are trimmed so a stray space or
// line break pasted into Vercel or PowerShell cannot cause a false mismatch.

// CRON_SECRET from Vercel, or null when missing or too short to be safe.
export function cronSecret(): string | null {
  const s = String(process.env.CRON_SECRET ?? "").trim();
  return s.length >= 16 ? s : null;
}

// True when the request carries "Authorization: Bearer <CRON_SECRET>".
// Constant-time comparison, so timing reveals nothing about the secret.
export function cronAuthorized(header: unknown, secret: string): boolean {
  const a = Buffer.from(String(header ?? "").trim());
  const b = Buffer.from(`Bearer ${secret}`);
  return a.length === b.length && timingSafeEqual(a, b);
}

// CONSENT_HASH_KEY from Vercel, or null when missing or too short. It must
// never be stored in the database: a copy of the database alone must not be
// enough to match archived consent to an email address.
export function consentHashKey(): string | null {
  const k = String(process.env.CONSENT_HASH_KEY ?? "").trim();
  return k.length >= 32 ? k : null;
}

// Keyed hash (HMAC-SHA256, hex). The "user:" / "email:" prefixes keep the two
// kinds of reference from ever matching each other.
export function consentUserRef(key: string, userId: string): string {
  return createHmac("sha256", key)
    .update(`user:${userId.trim().toLowerCase()}`, "utf8")
    .digest("hex");
}

export function consentEmailRef(key: string, email: string): string {
  return createHmac("sha256", key)
    .update(`email:${email.trim().toLowerCase()}`, "utf8")
    .digest("hex");
}
