import { useState } from "react";
import type { Invite } from "../lib/account";
import { track } from "../lib/track";

// Main-page card with the person's unused invite codes. Copy, or Share on
// phones (the system share sheet). Hidden when no codes are left.

export function InviteCard({ invites }: { invites: Invite[] }) {
  const open = invites.filter((i) => !i.used && !i.paused);
  const [copied, setCopied] = useState("");
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("vestry.inviteCard.collapsed") === "1";
    } catch {
      return false;
    }
  });

  if (open.length === 0) return null;

  const setCollapsedSaved = (v: boolean) => {
    setCollapsed(v);
    try {
      localStorage.setItem("vestry.inviteCard.collapsed", v ? "1" : "0");
    } catch {
      // storage unavailable: fine
    }
  };

  const message = (code: string) =>
    "Join me on Vestry, my AI stylist and digital closet. Use my invite code " +
    code +
    " at " +
    window.location.origin;

  const share = async (code: string) => {
    const nav: any = navigator;
    if (nav.share) {
      try {
        await nav.share({ title: "Vestry invite", text: message(code) });
        track("invite_shared", { method: "share_sheet" });
        return;
      } catch {
        // cancelled: fall through to copy
      }
    }
    try {
      await navigator.clipboard.writeText(message(code));
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
      track("invite_shared", { method: "copy" });
    } catch {
      // clipboard unavailable: the code is on screen anyway
    }
  };

  return (
    <div
      className="rounded-2xl p-4 mb-5"
      style={{ background: "var(--emerald)", color: "#F7F4EE" }}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="serif text-lg leading-tight">Invite friends to Vestry</p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(247,244,238,0.7)" }}>
            You have {open.length} invite{open.length === 1 ? "" : "s"} left. Each code lets one person join.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCollapsedSaved(!collapsed)}
          className="text-xs underline flex-shrink-0"
          style={{ color: "rgba(247,244,238,0.7)" }}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>
      {!collapsed && (
        <div className="mt-3 space-y-2">
          {open.map((inv) => (
            <div
              key={inv.code}
              className="flex items-center justify-between rounded-xl px-3 py-2"
              style={{ background: "rgba(255,255,255,0.08)" }}
            >
              <span className="mono text-sm tracking-wider">{inv.code}</span>
              <button
                type="button"
                onClick={() => share(inv.code)}
                className="text-xs font-medium px-3 py-1.5 rounded-full"
                style={{ background: "var(--gold)", color: "var(--emerald)" }}
              >
                {copied === inv.code ? "Copied" : "Share"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
