import { useCallback, useEffect, useState } from "react";
import { authFetch } from "../lib/authFetch";
import { track } from "../lib/track";
import { ErrorNote } from "./ui";

// Admin-only waiting list: approve (creates a founder invite code to send),
// decline or delete.

type Req = {
  id: string;
  email: string;
  phone_os: string | null;
  country: string | null;
  heard_from: string | null;
  status: "pending" | "approved" | "declined";
  invite_code: string | null;
  created_at: string;
};

const OS_LABEL: Record<string, string> = { iphone: "iPhone", android: "Android", other: "Other" };

export function AccessRequests() {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await authFetch("/api/admin-requests");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't load requests.");
      setRows(data.requests ?? []);
    } catch (e: any) {
      setError(e?.message || "Couldn't load requests.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (r: Req, action: "approve" | "decline" | "delete") => {
    if (busyId) return;
    if (action === "delete" && !window.confirm("Delete the request from " + r.email + "? Their email is removed.")) return;
    setBusyId(r.id);
    setError("");
    try {
      const res = await authFetch("/api/admin-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: r.id, action }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Couldn't update.");
      if (action === "approve") track("access_approved");
      await load();
    } catch (e: any) {
      setError(e?.message || "Couldn't update.");
    }
    setBusyId("");
  };

  const copyMessage = async (r: Req) => {
    if (!r.invite_code) return;
    const text =
      "You're in! Here's your Vestry invite code: " +
      r.invite_code +
      ". Open " +
      window.location.origin +
      ', tap "I have an invite code" and join.';
    try {
      await navigator.clipboard.writeText(text);
      setCopied(r.id);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // the code is on screen anyway
    }
  };

  const shown = (rows ?? []).filter((r) => filter === "all" || r.status === "pending");
  const pendingCount = (rows ?? []).filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {(["pending", "all"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className="px-3 py-1.5 rounded-full text-xs"
            style={
              filter === f
                ? { background: "var(--emerald)", color: "#F7F4EE" }
                : { background: "white", border: "1px solid var(--warm-grey)", color: "var(--mid-grey)" }
            }
          >
            {f === "pending" ? "Waiting (" + pendingCount + ")" : "All"}
          </button>
        ))}
        <button type="button" onClick={() => void load()} className="ml-auto text-xs underline" style={{ color: "var(--mid-grey)" }}>
          Refresh
        </button>
      </div>
      <ErrorNote>{error}</ErrorNote>
      {rows === null ? (
        <p className="text-sm" style={{ color: "var(--mid-grey)" }}>Loading…</p>
      ) : shown.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--mid-grey)" }}>No requests.</p>
      ) : (
        shown.map((r) => (
          <div key={r.id} className="bg-white rounded-2xl p-3.5 space-y-2" style={{ border: "1px solid var(--warm-grey)" }}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium break-all" style={{ color: "var(--ink)" }}>{r.email}</p>
                <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
                  {[r.phone_os ? OS_LABEL[r.phone_os] : null, r.country, new Date(r.created_at).toLocaleDateString()]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                {r.heard_from && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink)" }}>“{r.heard_from}”</p>
                )}
              </div>
              <span className="text-xs flex-shrink-0" style={{ color: r.status === "approved" ? "var(--emerald)" : "var(--mid-grey)" }}>
                {r.status === "pending" ? "Waiting" : r.status === "approved" ? "Approved" : "Declined"}
              </span>
            </div>
            {r.status === "approved" && r.invite_code && (
              <div className="flex items-center justify-between rounded-xl px-3 py-2" style={{ background: "var(--faint)" }}>
                <span className="mono text-sm tracking-wider">{r.invite_code}</span>
                <button type="button" onClick={() => copyMessage(r)} className="text-xs underline" style={{ color: "var(--emerald)" }}>
                  {copied === r.id ? "Copied" : "Copy message"}
                </button>
              </div>
            )}
            <div className="flex items-center gap-3">
              {r.status === "pending" && (
                <>
                  <button
                    type="button"
                    disabled={busyId === r.id}
                    onClick={() => act(r, "approve")}
                    className="text-xs font-medium px-3 py-1.5 rounded-full disabled:opacity-40"
                    style={{ background: "var(--emerald)", color: "#F7F4EE" }}
                  >
                    Approve
                  </button>
                  <button type="button" disabled={busyId === r.id} onClick={() => act(r, "decline")} className="text-xs underline" style={{ color: "var(--mid-grey)" }}>
                    Decline
                  </button>
                </>
              )}
              <button type="button" disabled={busyId === r.id} onClick={() => act(r, "delete")} className="text-xs underline ml-auto" style={{ color: "var(--error-ink)" }}>
                Delete
              </button>
            </div>
          </div>
        ))
      )}
      <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
        Approving creates a one-time invite code. Until the email service is set up, copy the message and send it yourself.
      </p>
    </div>
  );
}
