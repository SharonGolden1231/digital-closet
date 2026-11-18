import { createClient } from "@supabase/supabase-js";

const DEFAULT_DAILY_CAP = 100;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_CHARS = 6_000_000;
const MAX_CHAT_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 8000;
const MAX_CLOSET_CONTEXT_CHARS = 30000;

// The version of the "how Vestry uses AI" text the user must have accepted.
// Raise it in Vercel (AI_CONSENT_VERSION) when the text changes; everyone is
// then asked again.
export function currentConsentVersion(): string {
  return process.env.AI_CONSENT_VERSION || "2026-11-v1";
}

// HTTP statuses from the auth service that mean "this token is not valid".
// Anything else (network failure, 5xx, unknown) is a service problem, not a
// bad login, and must NOT sign the user out.
const TOKEN_REJECTED_STATUSES = [400, 401, 403, 404];

export function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function getBearerToken(req: any): string {
  const header = String(req.headers?.authorization ?? "");
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

// Verifies the login token ONLY. It does not count against the AI cap and
// records nothing. Used by routes that are not AI calls (saving a closet
// item). Returns the verified user id and token, or null after sending the
// error response.
export async function verifyUser(
  req: any,
  res: any,
  opts: { allowPendingDeletion?: boolean } = {}
): Promise<{ userId: string; token: string } | null> {
  const admin = getAdminClient();
  if (!admin) {
    console.error("Gate misconfigured: Supabase server settings are missing");
    res.status(500).json({ error: "Service unavailable" });
    return null;
  }

  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Please sign in." });
    return null;
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error) {
    const status = (error as any).status;
    if (TOKEN_REJECTED_STATUSES.includes(status)) {
      res.status(401).json({ error: "Session expired — please sign in again." });
    } else {
      // Auth service unreachable or failing. Deny the call, but with a 503 so
      // the app keeps the user signed in and their closet intact.
      console.error("Gate auth check failed:", error.message, status);
      res.status(503).json({
        error: "Sign-in service is temporarily unavailable — please try again in a moment.",
      });
    }
    return null;
  }
  if (!data?.user) {
    res.status(401).json({ error: "Session expired — please sign in again." });
    return null;
  }

  // An account that asked to be deleted is locked: nothing works except the
  // account route (which lets the person see the date or cancel). Fails
  // closed: if the check itself fails the call is refused with a 503.
  if (!opts.allowPendingDeletion) {
    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("deletion_requested_at")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError) {
      console.error("Gate profile check failed:", profileError.message);
      res.status(503).json({
        error: "Service is temporarily unavailable — please try again in a moment.",
      });
      return null;
    }
    if ((profile as any)?.deletion_requested_at) {
      res.status(403).json({
        error: "This account is scheduled for deletion.",
        code: "account_deleting",
      });
      return null;
    }
  }
  return { userId: data.user.id, token };
}

// True when the user's most recent AI-processing decision is "accepted" for
// the current text version. Returns null if the lookup itself failed.
export async function hasAiConsent(
  admin: any,
  userId: string
): Promise<boolean | null> {
  const { data, error } = await admin
    .from("consent_records")
    .select("granted, policy_version")
    .eq("user_id", userId)
    .eq("consent_type", "ai_processing")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Gate consent lookup failed:", error.message);
    return null;
  }
  return (
    data?.granted === true && data?.policy_version === currentConsentVersion()
  );
}

// Verifies the login token, enforces the per-user daily cap, and records the
// call. Returns the verified user id, or null after sending the error response.
export async function requireUser(
  req: any,
  res: any,
  endpoint: string
): Promise<string | null> {
  const auth = await verifyUser(req, res);
  if (!auth) return null;
  const userId = auth.userId;

  const admin = getAdminClient();
  if (!admin) {
    console.error("Gate misconfigured: Supabase server settings are missing");
    res.status(500).json({ error: "Service unavailable" });
    return null;
  }

  // Off until REQUIRE_AI_CONSENT=1 is set in Vercel, so this code can be
  // deployed before the app has its consent screen.
  if (process.env.REQUIRE_AI_CONSENT === "1") {
    const consented = await hasAiConsent(admin, userId);
    if (consented === null) {
      res.status(500).json({ error: "Service unavailable" });
      return null;
    }
    if (!consented) {
      res.status(403).json({
        error: "Please review and accept how Vestry uses AI first.",
        code: "consent_required",
      });
      return null;
    }
  }

  const cap = Number(process.env.AI_DAILY_CAP) || DEFAULT_DAILY_CAP;
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error: countError } = await admin
    .from("events")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("event_type", "ai_call")
    .gte("created_at", since);

  if (countError) {
    console.error("Gate count failed:", countError.message);
    res.status(500).json({ error: "Service unavailable" });
    return null;
  }
  if ((count ?? 0) >= cap) {
    res.status(429).json({ error: "Daily limit reached — try again tomorrow." });
    return null;
  }

  const { error: insertError } = await admin.from("events").insert({
    user_id: userId,
    event_type: "ai_call",
    payload: { endpoint },
  });
  if (insertError) {
    console.error("Gate insert failed:", insertError.message);
    res.status(500).json({ error: "Service unavailable" });
    return null;
  }

  return userId;
}

export function validImage(imageBase64: unknown, mediaType: unknown): boolean {
  return (
    typeof imageBase64 === "string" &&
    imageBase64.length > 0 &&
    imageBase64.length <= MAX_IMAGE_CHARS &&
    typeof mediaType === "string" &&
    ALLOWED_IMAGE_TYPES.includes(mediaType)
  );
}

// Returns an error message to send back, or null if the input is acceptable.
export function checkChatInput(
  messages: unknown,
  closetContext: unknown
): string | null {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "Missing messages";
  }
  if (messages.length > MAX_CHAT_MESSAGES) {
    return "Conversation too long — start a new chat.";
  }
  for (const m of messages) {
    if (!m || typeof m !== "object") return "Invalid message payload";
    const role = (m as any).role;
    const content = (m as any).content;
    if (role !== "user" && role !== "assistant") return "Invalid message payload";
    if (typeof content !== "string" || !content.trim()) {
      return "Invalid message payload";
    }
    if (content.length > MAX_MESSAGE_CHARS) return "Message too long";
  }
  if (closetContext !== undefined && closetContext !== null) {
    if (typeof closetContext !== "string") return "Invalid closet data";
    if (closetContext.length > MAX_CLOSET_CONTEXT_CHARS) {
      return "Closet data too large";
    }
  }
  return null;
}
