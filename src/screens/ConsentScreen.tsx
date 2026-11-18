import { useState } from "react";
import { Page, Title, Card, Primary, TextLink, ErrorNote } from "./ui";
import { setConsent, ApiError } from "../lib/account";
import { track } from "../lib/track";

// AI-processing consent. Shown before any AI feature can be used, and again
// whenever the text version on the server changes.
// DRAFT WORDING: to be reviewed by the lawyer before the pilot.

export function ConsentScreen({ onDone, onSignOut }: { onDone: () => void; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const accept = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await setConsent(true);
      track("consent_decision", { granted: true });
      onDone();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save your choice — please try again.");
      setBusy(false);
    }
  };

  return (
    <Page>
      <Title sub="Please read this once before we start.">How Vestry uses AI</Title>
      <Card>
        <ul className="text-sm space-y-3 leading-relaxed" style={{ color: "var(--ink)" }}>
          <li>
            <strong>What is sent.</strong> Photos of your clothes and their labels, the details of your closet, your
            style answers and what you write to the stylist are sent to our AI provider so it can recognise items
            and suggest outfits.
          </li>
          <li>
            <strong>Not for training.</strong> Our provider's terms do not allow your data to be used to train AI
            models.
          </li>
          <li>
            <strong>Your control.</strong> You can withdraw this at any time in Settings. Without it, the AI features
            (item recognition, tag reading, the stylist) are switched off.
          </li>
          <li>
            <strong>Deleting.</strong> You can delete your account and everything in it from Settings.
          </li>
        </ul>
      </Card>
      <ErrorNote>{error}</ErrorNote>
      <Primary onClick={accept} disabled={busy}>
        {busy ? "Saving…" : "I agree — continue"}
      </Primary>
      <div className="text-center">
        <TextLink onClick={onSignOut}>Not now — sign out</TextLink>
      </div>
    </Page>
  );
}
