import { useState } from "react";
import { supabase } from "../lib/supabase";
import { redeemInvite, ApiError } from "../lib/account";

// Create an account with an invite code (sign-ups are closed otherwise).
// Email typed twice, password at least 10 characters. On success the person
// is signed in straight away.

const fieldStyle = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(61,122,95,0.4)",
  color: "#F7F4EE",
};

const MIN_PASSWORD = 10;

export function InviteSignUp({ onBack }: { onBack: () => void }) {
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [email2, setEmail2] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const emailsMatch = email.trim().toLowerCase() === email2.trim().toLowerCase();
  const ready = code.trim().length >= 6 && email.trim() && email2.trim() && password.length >= MIN_PASSWORD;

  const submit = async () => {
    if (busy || !ready) return;
    if (!emailsMatch) {
      setError("The two email addresses don't match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await redeemInvite(code.trim().toUpperCase(), email.trim(), password);
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) {
        setError("Your account is ready — please sign in.");
        setBusy(false);
      }
      // On success the app moves on by itself (signed-in state).
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create your account — check your connection.");
      setBusy(false);
    }
  };

  const label = (t: string) => (
    <label className="text-xs uppercase tracking-widest font-medium block" style={{ color: "#B8956A" }}>
      {t}
    </label>
  );

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {label("Invite code")}
      <input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
        placeholder="e.g. H8YJJJDK7X"
        autoCapitalize="characters"
        autoComplete="off"
        autoFocus
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none mono tracking-wider"
        style={fieldStyle}
      />
      {label("Email")}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={fieldStyle}
      />
      <input
        type="email"
        value={email2}
        onChange={(e) => setEmail2(e.target.value)}
        onPaste={(e) => e.preventDefault()}
        placeholder="Type your email again"
        autoComplete="off"
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={fieldStyle}
      />
      {email2 && !emailsMatch && (
        <p className="text-xs" style={{ color: "#F5B5B5" }}>
          The emails don't match yet.
        </p>
      )}
      {label("Password")}
      <div className="relative">
        <input
          type={showPw ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value.slice(0, 72))}
          placeholder={"At least " + MIN_PASSWORD + " characters"}
          autoComplete="new-password"
          className="w-full px-4 py-3 pr-16 rounded-xl text-sm focus:outline-none"
          style={fieldStyle}
        />
        <button
          type="button"
          onClick={() => setShowPw(!showPw)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs"
          style={{ color: "rgba(181,175,164,0.8)" }}
        >
          {showPw ? "Hide" : "Show"}
        </button>
      </div>
      {password && password.length < MIN_PASSWORD && (
        <p className="text-xs" style={{ color: "rgba(181,175,164,0.8)" }}>
          {MIN_PASSWORD - password.length} more characters
        </p>
      )}
      {error && (
        <p className="text-xs" style={{ color: "#F5B5B5" }} role="alert">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={busy || !ready}
        className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
        style={{ background: "#B8956A", color: "#1A3028" }}
      >
        {busy ? "Creating your account…" : "Join →"}
      </button>
      <p className="text-xs text-center pt-1">
        <button type="button" onClick={onBack} className="underline" style={{ color: "rgba(181,175,164,0.8)" }}>
          I already have an account
        </button>
      </p>
    </form>
  );
}
