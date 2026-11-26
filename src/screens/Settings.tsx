import { useState } from "react";
import { Card, Label, Primary, Secondary, ErrorNote, inputStyle } from "./ui";
import { STYLES, GOALS, WEEKDAYS, SHOPS_FOR, BRAND_TIERS, FIT_ISSUES, labelOf, cmToFeetInches } from "./options";
import { requestDeletion, setConsent, deleteMeasurements, ApiError } from "../lib/account";
import type { AccountStatus, StyleProfile, Measurements } from "../lib/account";
import type { Step } from "./Onboarding";
import { track } from "../lib/track";
import { ChangePassword } from "./PasswordScreens";

// Settings: style answers, My invites, AI consent, delete account, sign out.
// Every answer can be changed later, also the ones skipped in the intro:
// each row opens its own intro screen.

function Row({ label, value, onEdit }: { label: string; value: string; onEdit?: () => void }) {
  return (
    <div className="flex justify-between items-baseline gap-4 text-sm">
      <span style={{ color: "var(--mid-grey)" }}>{label}</span>
      <span className="text-right" style={{ color: "var(--ink)" }}>
        {value || "—"}
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-2 text-xs underline"
            style={{ color: "var(--emerald)" }}
            aria-label={(value ? "Change " : "Add ") + label}
          >
            {value ? "Change" : "Add"}
          </button>
        )}
      </span>
    </div>
  );
}

function heightText(cm: number | null): string {
  if (!cm) return "";
  const fi = cmToFeetInches(cm);
  return `${cm} cm (${fi.ft}′${fi.inch}″)`;
}

export function Settings({
  account,
  profile,
  measurements,
  onMeasurementsDeleted,
  onEditAnswers,
  onConsentWithdrawn,
  onDeletionRequested,
  onSignOut,
}: {
  account: AccountStatus;
  profile: StyleProfile | null;
  measurements: Measurements | null;
  onMeasurementsDeleted: () => void;
  // No step: walk through all intro screens; a step: open that screen only.
  onEditAnswers: (step?: Step) => void;
  onConsentWithdrawn: () => void;
  onDeletionRequested: () => void;
  onSignOut: () => void;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [showDelete, setShowDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");

  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    } catch {
      // Clipboard not available: the code is visible on screen anyway.
    }
  };

  const withdraw = async () => {
    if (busy) return;
    if (!window.confirm("Switch off AI features? Item recognition, tag reading and the stylist will stop working.")) {
      return;
    }
    setBusy(true);
    setError("");
    try {
      await setConsent(false);
      track("consent_decision", { granted: false });
      onConsentWithdrawn();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const removeMeasurements = async () => {
    if (busy) return;
    // Withdraws the measurements consent: deletes current values AND history.
    if (!window.confirm("This deletes your measurements and their history. Continue?")) return;
    setBusy(true);
    setError("");
    try {
      await deleteMeasurements();
      onMeasurementsDeleted();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't delete — please try again.");
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (busy || confirmText.trim().toUpperCase() !== "DELETE") return;
    setBusy(true);
    setError("");
    try {
      await requestDeletion();
      track("account_deletion_requested");
      onDeletionRequested();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't schedule deletion — please try again.");
      setBusy(false);
    }
  };

  const list = (ids: string[], opts: { id: string; label: string }[]) => ids.map((i) => labelOf(opts, i)).join(", ");

  return (
    <div className="space-y-5">
      <Card>
        <Label>Your style answers</Label>
        {profile ? (
          <div className="space-y-1.5">
            <Row label="Name" value={profile.first_name ?? ""} onEdit={() => onEditAnswers("about")} />
            <Row
              label="Shop"
              value={profile.shops_for ? labelOf(SHOPS_FOR, profile.shops_for) : ""}
              onEdit={() => onEditAnswers("shop")}
            />
            <Row label="Weekdays" value={list(profile.weekdays, WEEKDAYS)} onEdit={() => onEditAnswers("week")} />
            <Row label="Style" value={list(profile.style_now, STYLES)} onEdit={() => onEditAnswers("style")} />
            <Row label="Style icon" value={profile.style_icon ?? ""} onEdit={() => onEditAnswers("style")} />
            <Row label="Goals" value={list(profile.goals, GOALS)} onEdit={() => onEditAnswers("goals")} />
            <Row
              label="Brands"
              value={[list(profile.brand_tiers, BRAND_TIERS), profile.brands.join(", ")].filter(Boolean).join(" · ")}
              onEdit={() => onEditAnswers("brands")}
            />
            <Row label="Height" value={heightText(profile.height_cm)} onEdit={() => onEditAnswers("fit")} />
            <Row label="Fit" value={list(profile.fit_issues, FIT_ISSUES)} onEdit={() => onEditAnswers("fit")} />
            <Row
              label="Colours"
              value={[
                profile.colors_love.length ? "Love: " + profile.colors_love.join(", ") : "",
                profile.colors_avoid.length ? "Avoid: " + profile.colors_avoid.join(", ") : "",
              ]
                .filter(Boolean)
                .join(" · ")}
              onEdit={() => onEditAnswers("fit")}
            />
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--mid-grey)" }}>
            Not answered yet.
          </p>
        )}
        <Secondary onClick={() => onEditAnswers()}>Go through all questions</Secondary>
      </Card>

      <Card>
        <Label hint="Private to you. Never shared.">Body measurements</Label>
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          {measurements ? "Saved." : "Not added."}
        </p>
        <Secondary onClick={() => onEditAnswers("fit")} disabled={busy}>
          {measurements ? "Change measurements" : "Add measurements"}
        </Secondary>
        {measurements && (
          <Secondary onClick={removeMeasurements} disabled={busy}>
            Remove my measurements
          </Secondary>
        )}
      </Card>

      <Card>
        <Label hint="Each code lets one person join Vestry.">My invites</Label>
        {account.invites.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--mid-grey)" }}>
            No invite codes yet.
          </p>
        ) : (
          <div className="space-y-2">
            {account.invites.map((inv) => (
              <div key={inv.code} className="flex items-center justify-between gap-3">
                <span className="mono text-sm" style={{ color: inv.used || inv.paused ? "var(--mid-grey)" : "var(--ink)" }}>
                  {inv.code}
                </span>
                <span className="text-xs" style={{ color: "var(--mid-grey)" }}>
                  {inv.used ? "Used" : inv.paused ? "Paused" : ""}
                </span>
                {!inv.used && !inv.paused && (
                  <button
                    type="button"
                    onClick={() => copy(inv.code)}
                    className="text-xs underline"
                    style={{ color: "var(--emerald)" }}
                  >
                    {copied === inv.code ? "Copied" : "Copy"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <ChangePassword />

      <Card>
        <Label>AI features</Label>
        <p className="text-sm" style={{ color: "var(--ink)" }}>
          {account.aiConsent ? "On — you agreed to how Vestry uses AI." : "Off."}
        </p>
        {account.aiConsent && (
          <Secondary onClick={withdraw} disabled={busy}>
            Withdraw consent
          </Secondary>
        )}
      </Card>

      <Card>
        <Label>Delete account</Label>
        {!showDelete ? (
          <Secondary onClick={() => setShowDelete(true)}>Delete my account…</Secondary>
        ) : (
          <div className="space-y-3">
            <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
              Your account is locked straight away and permanently deleted after 14 days, with all your items and
              photos. You can cancel during those 14 days. Type <strong>DELETE</strong> to confirm.
            </p>
            <input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE"
              autoCapitalize="characters"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
              style={inputStyle}
            />
            <button
              type="button"
              onClick={deleteAccount}
              disabled={busy || confirmText.trim().toUpperCase() !== "DELETE"}
              className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
              style={{ background: "var(--error-ink)", color: "#fff" }}
            >
              {busy ? "Scheduling…" : "Delete my account"}
            </button>
            <Secondary onClick={() => { setShowDelete(false); setConfirmText(""); }}>Keep my account</Secondary>
          </div>
        )}
      </Card>

      <ErrorNote>{error}</ErrorNote>
      <Primary onClick={onSignOut}>Sign out</Primary>
    </div>
  );
}
