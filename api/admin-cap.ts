import { getAdminClient } from "./_lib/gate.js";
import { cronSecret, cronAuthorized } from "./_lib/secrets.js";

// Founder-only controls for the invite release. Protected by the same secret
// as the purge job (Authorization: Bearer <CRON_SECRET>).
//   GET                         -> { cap, used, pending }
//   POST {cap: 25}              -> release more spots (0 to 500)
//   POST {founderCodes: 5}      -> make 1 to 20 founder invite codes

const MAX_CAP = 500;

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = cronSecret();
  if (!secret) {
    console.error("admin-cap: CRON_SECRET is missing or too short");
    return res.status(500).json({ error: "Not configured" });
  }
  if (!cronAuthorized(req.headers?.authorization, secret)) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const admin = getAdminClient();
  if (!admin) {
    return res.status(500).json({ error: "Not configured" });
  }

  try {
    const body = req.body && typeof req.body === "object" ? req.body : {};

    if (req.method === "POST" && body.cap !== undefined) {
      const cap = Number(body.cap);
      if (!Number.isInteger(cap) || cap < 0 || cap > MAX_CAP) {
        return res
          .status(400)
          .json({ error: `cap must be a whole number from 0 to ${MAX_CAP}` });
      }
      const { error } = await admin
        .from("app_settings")
        .update({ value: cap, updated_at: new Date().toISOString() })
        .eq("key", "user_cap");
      if (error) {
        console.error("admin-cap update failed:", error.message);
        return res.status(500).json({ error: "Update failed" });
      }
    }

    let founderCodes: string[] | undefined;
    if (req.method === "POST" && body.founderCodes !== undefined) {
      const n = Number(body.founderCodes);
      if (!Number.isInteger(n) || n < 1 || n > 20) {
        return res
          .status(400)
          .json({ error: "founderCodes must be a whole number from 1 to 20" });
      }
      const { data, error } = await admin.rpc("issue_invite_codes", {
        p_owner: null,
        p_count: n,
      });
      if (error) {
        console.error("admin-cap codes failed:", error.message);
        return res.status(500).json({ error: "Could not make codes" });
      }
      founderCodes = (data ?? []) as string[];
    }

    const { data: cap, error: capError } = await admin.rpc("invite_capacity");
    if (capError) {
      console.error("admin-cap read failed:", capError.message);
      return res.status(500).json({ error: "Read failed" });
    }
    const row = Array.isArray(cap) ? cap[0] : cap;
    return res.status(200).json({ ...row, ...(founderCodes ? { founderCodes } : {}) });
  } catch (error: any) {
    console.error("admin-cap error:", error?.message);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
