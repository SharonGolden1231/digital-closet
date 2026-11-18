import { verifyUser, getAdminClient } from "./_lib/gate.js";

// Admin only: the waiting list.
//   GET                                   -> { requests: [...] } (newest first;
//                                            approved ones say whether the
//                                            person joined with their code)
//   POST {id, action: "approve"}          -> creates a founder invite code -> { code }
//   POST {id, action: "decline"}
//   POST {id, action: "delete"}           -> removes the request and its email
// The admin flag is read from the database with the server key; the app's
// own copy of the flag is never trusted.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ACTIONS = ["approve", "decline", "delete"];

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const auth = await verifyUser(req, res);
    if (!auth) return;
    const admin = getAdminClient();
    if (!admin) return res.status(500).json({ error: "Service unavailable" });

    const { data: prof, error: profErr } = await admin
      .from("profiles")
      .select("is_admin")
      .eq("id", auth.userId)
      .maybeSingle();
    if (profErr) {
      console.error("admin-requests: admin check failed:", profErr.message);
      return res.status(503).json({ error: "Service unavailable" });
    }
    // Same answer as a missing route, so non-admins learn nothing.
    if ((prof as any)?.is_admin !== true) return res.status(404).json({ error: "Not found" });

    if (req.method === "GET") {
      const { data, error } = await admin
        .from("access_requests")
        .select("id, email, phone_os, country, heard_from, status, invite_code, created_at, decided_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) {
        console.error("admin-requests list failed:", error.message);
        return res.status(500).json({ error: "Couldn't load requests." });
      }
      const rows = (data ?? []) as any[];
      const codes = rows.map((r) => r.invite_code).filter((c): c is string => typeof c === "string" && c.length > 0);
      const joinedAt = new Map<string, string>();
      if (codes.length > 0) {
        const { data: used, error: usedErr } = await admin
          .from("invite_codes")
          .select("code, redeemed_at")
          .in("code", codes);
        if (usedErr) {
          // The list still loads; only the "Joined" labels are missing.
          console.error("admin-requests joined lookup failed:", usedErr.message);
        }
        for (const u of (used ?? []) as any[]) {
          if (u.redeemed_at) joinedAt.set(String(u.code), String(u.redeemed_at));
        }
      }
      return res.status(200).json({
        requests: rows.map((r) => ({
          ...r,
          joined_at: r.invite_code ? joinedAt.get(r.invite_code) ?? null : null,
        })),
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};
    const id = String(body.id ?? "");
    const action = String(body.action ?? "");
    if (!UUID_RE.test(id) || !ACTIONS.includes(action)) {
      return res.status(400).json({ error: "Invalid request." });
    }

    if (action === "delete") {
      const { error } = await admin.from("access_requests").delete().eq("id", id);
      if (error) {
        console.error("admin-requests delete failed:", error.message);
        return res.status(500).json({ error: "Couldn't delete." });
      }
      return res.status(200).json({ ok: true });
    }

    const { data: row, error: rowErr } = await admin
      .from("access_requests")
      .select("status, invite_code")
      .eq("id", id)
      .maybeSingle();
    if (rowErr) return res.status(500).json({ error: "Couldn't load the request." });
    if (!row) return res.status(404).json({ error: "Request not found." });

    if (action === "decline") {
      const { error } = await admin
        .from("access_requests")
        .update({ status: "declined", decided_at: new Date().toISOString(), decided_by: auth.userId })
        .eq("id", id)
        .eq("status", "pending");
      if (error) return res.status(500).json({ error: "Couldn't update." });
      return res.status(200).json({ ok: true });
    }

    // approve: idempotent, a second click returns the same code.
    if ((row as any).status === "approved" && (row as any).invite_code) {
      return res.status(200).json({ ok: true, code: (row as any).invite_code });
    }
    if ((row as any).status !== "pending") {
      return res.status(409).json({ error: "This request was already decided." });
    }
    const { data: codes, error: codeErr } = await admin.rpc("issue_invite_codes", {
      p_owner: null,
      p_count: 1,
    });
    const code = Array.isArray(codes) ? String(codes[0] ?? "") : "";
    if (codeErr || !code) {
      console.error("admin-requests code failed:", codeErr?.message);
      return res.status(500).json({ error: "Couldn't create an invite code." });
    }
    const { error: updErr } = await admin
      .from("access_requests")
      .update({
        status: "approved",
        invite_code: code,
        decided_at: new Date().toISOString(),
        decided_by: auth.userId,
      })
      .eq("id", id)
      .eq("status", "pending");
    if (updErr) {
      console.error("admin-requests approve failed:", updErr.message);
      return res.status(500).json({ error: "Couldn't save the approval." });
    }
    return res.status(200).json({ ok: true, code });
  } catch (e: any) {
    console.error("admin-requests error:", e?.message);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
