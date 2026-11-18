import { useState } from "react";
import type { Invite } from "../lib/account";
import { track } from "../lib/track";

// Slim main-page bar: "N invites left" + Invite button. Tapping "codes"
// opens a small list with Copy / Share per code. Hidden when none are left.

export function InviteCard({ invites }: { invites: Invite[] }) {
  const open = invites.filter((i) => !i.used && !i.paused);
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState("");

  if (open.length === 0) return null;

  const message = (code: string) =>
    "Join me on Vestry, my AI stylist and digital closet. Use my invite code " +
    code +
    " at " +
    window.location.origin;

  const canShare = typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(message(code));
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
      track("invite_shared", { method: "copy" });
    } catch {
      // clipboard unavailable: the code is on screen anyway
    }
  };

  const share = async (code: string) => {
    if (!canShare) return copy(code);
    try {
      await (navigator as any).share({ title: "Vestry invite", text: message(code) });
      track("invite_shared", { method: "share_sheet" });
    } catch {
      // cancelled by the person: nothing to do
    }
  };

  const linkStyle = { color: "var(--emerald)" };

  return (
    <div
      className="rounded-xl mb-4 px-3.5 py-2.5"
      style={{ background: "white", border: "1px solid var(--warm-grey)" }}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--ink)" }}>
          <span style={{ color: "var(--gold)" }}>✦</span>{" "}
          <span className="font-medium">
            {open.length} invite{open.length === 1 ? "" : "s"}
          </span>{" "}
          <span style={{ color: "var(--mid-grey)" }}>to share with friends</span>
        </p>
        <div className="flex items-center gap-3 flex-shrink-0">
          <button type="button" onClick={() => setExpanded(!expanded)} className="text-xs underline" style={linkStyle}>
            {expanded ? "Hide" : "Codes"}
          </button>
          <button
            type="button"
            onClick={() => share(open[0].code)}
            className="text-xs font-medium px-3 py-1 rounded-full"
            style={{ background: "var(--emerald)", color: "#F7F4EE" }}
          >
            {copied === open[0].code ? "Copied" : "Invite"}
          </button>
        </div>
      </div>
      {expanded && (
        <div className="mt-2 pt-2 space-y-1.5" style={{ borderTop: "1px solid var(--faint)" }}>
          {open.map((inv) => (
            <div key={inv.code} className="flex items-center justify-between">
              <span className="mono text-xs tracking-wider" style={{ color: "var(--ink)" }}>
                {inv.code}
              </span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => copy(inv.code)} className="text-xs underline" style={linkStyle}>
                  {copied === inv.code ? "Copied" : "Copy"}
                </button>
                {canShare && (
                  <button type="button" onClick={() => share(inv.code)} className="text-xs underline" style={linkStyle}>
                    Share
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
