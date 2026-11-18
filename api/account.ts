import { verifyUser, currentConsentVersion } from "./_lib/gate.js";
import { userClient } from "./_lib/closet.js";

// Signed-in account actions, all performed AS THE USER (row-level security
// and the database functions use the caller's own identity):
//   GET                      -> deletion status, AI consent status, own invite codes
//   POST {action:"request_deletion"}  -> schedule account deletion (14 days)
//   POST {action:"cancel_deletion"}   -> cancel it
//   POST {action:"consent", granted}  -> record the AI-processing decision

const GRACE_DAYS = 14; // matches the database function accounts_due_for_purge

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // The one route a user with a pending deletion may still use.
    const auth = await verifyUser(req, res, { allowPendingDeletion: true });
    if (!auth) return;
    const db = userClient(auth.token);
    if (!db) {
      console.error("account: Supabase server settings are missing");
      return res.status(500).json({ error: "Service unavailable" });
    }

    if (req.method === "GET") {
      const version = currentConsentVersion();
      const [profile, consent, codes] = await Promise.all([
        db
          .from("profiles")
          .select("deletion_requested_at")
          .eq("id", auth.userId)
          .maybeSingle(),
        db
          .from("consent_records")
          .select("granted, policy_version")
          .eq("consent_type", "ai_processing")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        db
          .from("invite_codes")
          .select("code, redeemed_at")
          .is("revoked_at", null)
          .order("created_at", { ascending: true })
          .limit(20),
      ]);
      if (profile.error || consent.error || codes.error) {
        console.error(
          "account status failed:",
          profile.error?.message,
          consent.error?.message,
          codes.error?.message
        );
        return res.status(500).json({ error: "Couldn't load your account." });
      }

      const requestedAt: string | null =
        (profile.data as any)?.deletion_requested_at ?? null;
      const deleteOn = requestedAt
        ? new Date(
            new Date(requestedAt).getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000
          ).toISOString()
        : null;
      const c = consent.data as any;
      return res.status(200).json({
        deletionRequestedAt: requestedAt,
        deleteOn,
        aiConsent: c?.granted === true && c?.policy_version === version,
        consentVersion: version,
        // Unused codes stop working while deletion is pending (option C) and
        // work again if it is cancelled, so they are shown as paused.
        invites: ((codes.data ?? []) as any[]).map((r) => ({
          code: r.code,
          used: Boolean(r.redeemed_at),
          paused: Boolean(requestedAt) && !r.redeemed_at,
        })),
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const action = String(body.action ?? "");

    if (action === "request_deletion") {
      const { data, error } = await db.rpc("request_account_deletion");
      if (error) {
        console.error("request_deletion failed:", error.message);
        return res.status(500).json({ error: "Couldn't schedule deletion." });
      }
      const requestedAt = String(data);
      return res.status(200).json({
        ok: true,
        deletionRequestedAt: requestedAt,
        deleteOn: new Date(
          new Date(requestedAt).getTime() + GRACE_DAYS * 24 * 60 * 60 * 1000
        ).toISOString(),
      });
    }

    if (action === "cancel_deletion") {
      const { data, error } = await db.rpc("cancel_account_deletion");
      if (error) {
        console.error("cancel_deletion failed:", error.message);
        return res.status(500).json({ error: "Couldn't cancel deletion." });
      }
      if (data === "full") {
        // Spots were released when deletion was requested; no room right now.
        return res.status(409).json({
          error:
            "Vestry is opening in small batches and there is no free spot right now. Your account will be deleted on schedule unless a spot opens — please try again soon.",
          code: "batch_full",
        });
      }
      return res.status(200).json({ ok: true });
    }

    if (action === "consent") {
      if (typeof body.granted !== "boolean") {
        return res.status(400).json({ error: "Invalid request." });
      }
      // The version always comes from the server, never from the app.
      const { error } = await db.rpc("record_consent", {
        p_type: "ai_processing",
        p_version: currentConsentVersion(),
        p_granted: body.granted,
      });
      if (error) {
        // The database refuses a NEW consent while deletion is pending
        // (withdrawing is always allowed).
        if (/account_deleting/.test(error.message)) {
          return res.status(403).json({
            error: "This account is scheduled for deletion.",
            code: "account_deleting",
          });
        }
        console.error("consent failed:", error.message);
        return res.status(500).json({ error: "Couldn't save your choice." });
      }
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: "Unknown action." });
  } catch (error: any) {
    console.error("account error:", error?.message);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
