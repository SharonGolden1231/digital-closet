import { useState } from "react";
import { supabase } from "../lib/supabase";
import { Page, Title, Primary, Secondary, ErrorNote, Card, Label, inputStyle } from "./ui";
import { track } from "../lib/track";

// Password helpers: "forgot password" (on the sign-in screen), "set a new
// password" (after opening the emailed link) and "change password" (Settings).

export const MIN_PASSWORD = 10;
const MAX_PASSWORD = 72;

const darkField = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(61,122,95,0.4)",
  color: "#F7F4EE",
};

// Turns Supabase sign-in errors into accurate, plain messages.
export function signInErrorMessage(err: { message?: string; code?: string; status?: number } | null | undefined): string {
  const code = String((err as any)?.code ?? "");
  const msg = String(err?.message ?? "");
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg)) {
    return "This email address hasn't been confirmed yet. Please contact Vestry support.";
  }
  if (code === "invalid_credentials" || /invalid login/i.test(msg)) {
    return "Incorrect email or password.";
  }
  if (code === "over_request_rate_limit" || (err as any)?.status === 429 || /rate limit|too many/i.test(msg)) {
    return "Too many attempts — please wait a few minutes and try again.";
  }
  if (code === "user_banned") return "This account can't sign in. Please contact Vestry support.";
  return "Couldn't sign in — check your connection and try again.";
}

// Shown on the dark sign-in screen.
export function ForgotPassword({ initialEmail, onBack }: { initialEmail: string; onBack: () => void }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin,
      });
      // Same answer whether or not the email has an account, so the screen
      // never reveals who is a member. Only a rate limit is reported.
      if (resetError && ((resetError as any).status === 429 || /rate limit/i.test(resetError.message))) {
        setError("Too many requests — please wait a few minutes and try again.");
        setBusy(false);
        return;
      }
      track("password_reset_requested");
      setSent(true);
    } catch {
      setError("Couldn't send the email — check your connection and try again.");
    }
    setBusy(false);
  };

  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm leading-relaxed" style={{ color: "#F7F4EE" }}>
          If an account exists for that email, a link to set a new password is on its way. Open it on this device.
        </p>
        <button type="button" onClick={onBack} className="text-xs underline" style={{ color: "rgba(181,175,164,0.8)" }}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <label className="text-xs uppercase tracking-widest font-medium block" style={{ color: "#B8956A" }}>
        Email
      </label>
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="username"
        autoFocus
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={darkField}
      />
      {error && (
        <p className="text-xs" style={{ color: "#F5B5B5" }} role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !email.trim()}
        className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
        style={{ background: "#B8956A", color: "#1A3028" }}
      >
        {busy ? "Sending…" : "Email me a reset link"}
      </button>
      <p className="text-xs text-center pt-1">
        <button type="button" onClick={onBack} className="underline" style={{ color: "rgba(181,175,164,0.8)" }}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}

function NewPasswordFields({
  pw,
  setPw,
  pw2,
  setPw2,
}: {
  pw: string;
  setPw: (v: string) => void;
  pw2: string;
  setPw2: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="space-y-2">
      <input
        type={show ? "text" : "password"}
        value={pw}
        onChange={(e) => setPw(e.target.value.slice(0, MAX_PASSWORD))}
        placeholder={"New password (at least " + MIN_PASSWORD + " characters)"}
        autoComplete="new-password"
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={inputStyle}
      />
      <input
        type={show ? "text" : "password"}
        value={pw2}
        onChange={(e) => setPw2(e.target.value.slice(0, MAX_PASSWORD))}
        placeholder="Type the new password again"
        autoComplete="new-password"
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={inputStyle}
      />
      <button type="button" onClick={() => setShow(!show)} className="text-xs underline" style={{ color: "var(--mid-grey)" }}>
        {show ? "Hide passwords" : "Show passwords"}
      </button>
    </div>
  );
}

function checkNew(pw: string, pw2: string): string {
  if (pw.length < MIN_PASSWORD) return "Choose a password of at least " + MIN_PASSWORD + " characters.";
  if (pw !== pw2) return "The two passwords don't match.";
  return "";
}

function updateErrorMessage(err: any): string {
  const code = String(err?.code ?? "");
  if (code === "same_password") return "Choose a password different from your current one.";
  if (code === "weak_password") return "That password is too weak — try a longer one.";
  if (code === "reauthentication_needed") return "For security, please sign out, sign in again and retry.";
  return "Couldn't save the new password — please try again.";
}

// After the person opens the emailed link they are signed in for recovery.
export function SetNewPassword({ onDone }: { onDone: () => void }) {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const problem = checkNew(pw, pw2);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    const { error: updError } = await supabase.auth.updateUser({ password: pw });
    if (updError) {
      setError(updateErrorMessage(updError));
      setBusy(false);
      return;
    }
    onDone();
  };

  return (
    <Page>
      <Title sub="Pick a new password for your account.">Set a new password</Title>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <NewPasswordFields pw={pw} setPw={setPw} pw2={pw2} setPw2={setPw2} />
        <ErrorNote>{error}</ErrorNote>
        <Primary type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save new password"}
        </Primary>
      </form>
      <Secondary onClick={() => void supabase.auth.signOut()}>Cancel and sign out</Secondary>
    </Page>
  );
}

// Settings: requires the current password, so a borrowed unlocked phone
// cannot be used to take over the account.
export function ChangePassword() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const reset = () => {
    setOpen(false);
    setCurrent("");
    setPw("");
    setPw2("");
    setError("");
  };

  const save = async () => {
    if (busy) return;
    const problem = checkNew(pw, pw2);
    if (problem) {
      setError(problem);
      return;
    }
    if (!current) {
      setError("Enter your current password.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email;
      if (!email) throw new Error("no email");
      const { error: checkError } = await supabase.auth.signInWithPassword({ email, password: current });
      if (checkError) {
        setError(
          String((checkError as any).code) === "invalid_credentials"
            ? "Your current password isn't right."
            : signInErrorMessage(checkError)
        );
        setBusy(false);
        return;
      }
      const { error: updError } = await supabase.auth.updateUser({ password: pw });
      if (updError) {
        setError(updateErrorMessage(updError));
        setBusy(false);
        return;
      }
      reset();
      setDone(true);
      track("password_changed", { via: "settings" });
    } catch {
      setError("Couldn't change the password — please try again.");
    }
    setBusy(false);
  };

  return (
    <Card>
      <Label>Password</Label>
      {done && !open && (
        <p className="text-sm" style={{ color: "var(--emerald)" }}>
          Password changed.
        </p>
      )}
      {!open ? (
        <Secondary onClick={() => { setOpen(true); setDone(false); }}>Change password</Secondary>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <input
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value.slice(0, MAX_PASSWORD))}
            placeholder="Current password"
            autoComplete="current-password"
            className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
            style={inputStyle}
          />
          <NewPasswordFields pw={pw} setPw={setPw} pw2={pw2} setPw2={setPw2} />
          <ErrorNote>{error}</ErrorNote>
          <Primary type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save new password"}
          </Primary>
          <Secondary onClick={reset}>Cancel</Secondary>
        </form>
      )}
    </Card>
  );
}
