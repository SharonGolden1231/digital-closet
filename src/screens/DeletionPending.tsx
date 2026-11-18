import { useState } from "react";
import { Page, Title, Card, Primary, Secondary, ErrorNote } from "./ui";
import { cancelDeletion, ApiError } from "../lib/account";
import { track } from "../lib/track";

// Shown whenever the account has a deletion request. The account is locked:
// only this screen works until the deletion is cancelled or carried out.

export function DeletionPending({
  deleteOn,
  onCancelled,
  onSignOut,
}: {
  deleteOn: string | null;
  onCancelled: () => void;
  onSignOut: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const when = deleteOn
    ? new Date(deleteOn).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
    : "in 14 days";

  const cancel = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await cancelDeletion();
      track("account_deletion_cancelled");
      onCancelled();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't cancel — please try again.");
      setBusy(false);
    }
  };

  return (
    <Page>
      <Title sub={"Your account and everything in it will be permanently deleted on " + when + "."}>
        Account scheduled for deletion
      </Title>
      <Card>
        <p className="text-sm leading-relaxed" style={{ color: "var(--ink)" }}>
          Until then your account is locked. If you changed your mind, you can cancel the deletion below.
        </p>
      </Card>
      <ErrorNote>{error}</ErrorNote>
      <Primary onClick={cancel} disabled={busy}>
        {busy ? "Cancelling…" : "Cancel deletion"}
      </Primary>
      <Secondary onClick={onSignOut}>Sign out</Secondary>
    </Page>
  );
}
