import { createClient } from "@supabase/supabase-js";

const DEFAULT_DAILY_CAP = 100;
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE_CHARS = 6_000_000;
const MAX_CHAT_MESSAGES = 30;
const MAX_MESSAGE_CHARS = 8000;
const MAX_CLOSET_CONTEXT_CHARS = 30000;

// HTTP statuses from the auth service that mean "this token is not valid".
// Anything else (network failure, 5xx, unknown) is a service problem, not a
// bad login, and must NOT sign the user out.
const TOKEN_REJECTED_STATUSES = [400, 401, 403, 404];

function getAdminClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Verifies the login token, enforces the per-user daily cap, and records the
// call. Returns the verified user id, or null after sending the error response.
export async function requireUser(
  req: any,
  res: any,
  endpoint: string
): Promise<string | null> {
  const admin = getAdminClient();
  if (!admin) {
    console.error("Gate misconfigured: Supabase server settings are missing");
    res.status(500).json({ error: "Service unavailable" });
    return null;
  }

  const header = String(req.headers?.authorization ?? "");
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
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
  const userId = data.user.id;

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
