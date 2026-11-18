import { useMemo, useRef, useState } from "react";
import { track } from "../lib/track";
import { countryOptions } from "../lib/countries";

// Waiting-list form on the (dark) sign-in screen. Also offered when the
// current wave is full.

const field = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(61,122,95,0.4)",
  color: "#F7F4EE",
};

const OS = [
  { id: "iphone", label: "iPhone" },
  { id: "android", label: "Android" },
  { id: "other", label: "Other" },
];

export function RequestAccess({ onBack, waveFull = false }: { onBack: () => void; waveFull?: boolean }) {
  const started = useRef(Date.now());
  const [email, setEmail] = useState("");
  const [phoneOs, setPhoneOs] = useState("");
  const [country, setCountry] = useState("");
  const [heard, setHeard] = useState("");
  const [website, setWebsite] = useState(""); // hidden trap for bots
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const countries = useMemo(() => countryOptions(), []);
  const [error, setError] = useState("");

  const submit = async () => {
    if (busy || !email.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/request-access", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          phone_os: phoneOs || null,
          country,
          heard_from: heard,
          website,
          started_at: started.current,
        }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch {
        data = {};
      }
      if (!res.ok) {
        setError(data.error || "Couldn't send your request — please try again.");
        setBusy(false);
        return;
      }
      track("access_requested", { phone_os: phoneOs || "unknown", wave_full: waveFull });
      setDone(true);
    } catch {
      setError("Couldn't send your request — check your connection.");
    }
    setBusy(false);
  };

  const label = (t: string) => (
    <label className="text-xs uppercase tracking-widest font-medium block" style={{ color: "#B8956A" }}>
      {t}
    </label>
  );

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="serif text-xl" style={{ color: "#F7F4EE" }}>
          You're on the list
        </p>
        <p className="text-sm leading-relaxed" style={{ color: "rgba(247,244,238,0.8)" }}>
          We're opening in small groups. When a spot is ready for you, you'll get an invite code.
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
      <p className="text-sm leading-relaxed" style={{ color: "rgba(247,244,238,0.85)" }}>
        {waveFull
          ? "This group is full right now. Leave your email and we'll send you a code when the next spots open."
          : "No invite code yet? Join the waiting list and we'll send you one when a spot opens."}
      </p>
      {label("Email")}
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoComplete="email"
        autoFocus
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={field}
      />
      {label("Your phone")}
      <div className="flex gap-2">
        {OS.map((o) => (
          <button
            key={o.id}
            type="button"
            onClick={() => setPhoneOs(phoneOs === o.id ? "" : o.id)}
            aria-pressed={phoneOs === o.id}
            className="flex-1 py-2 rounded-xl text-sm"
            style={
              phoneOs === o.id
                ? { background: "#B8956A", color: "#1A3028" }
                : { ...field, color: "rgba(247,244,238,0.85)" }
            }
          >
            {o.label}
          </button>
        ))}
      </div>
      {label("Country (optional)")}
      <select
        value={country}
        onChange={(e) => setCountry(e.target.value)}
        autoComplete="country-name"
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none appearance-none"
        style={{ ...field, color: country ? "#F7F4EE" : "rgba(247,244,238,0.5)" }}
      >
        <option value="" style={{ color: "#1A3028" }}>
          Choose your country
        </option>
        <optgroup label="Most common">
          {countries.slice(0, 5).map((c) => (
            <option key={c.code} value={c.name} style={{ color: "#1A3028" }}>
              {c.name}
            </option>
          ))}
        </optgroup>
        <optgroup label="All countries">
          {countries.slice(5).map((c) => (
            <option key={c.code} value={c.name} style={{ color: "#1A3028" }}>
              {c.name}
            </option>
          ))}
        </optgroup>
      </select>
      {label("How did you hear about us? (optional)")}
      <input
        value={heard}
        onChange={(e) => setHeard(e.target.value.slice(0, 200))}
        placeholder="A friend, Instagram…"
        className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
        style={field}
      />
      {/* Hidden from people; bots tend to fill every field. */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }}
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
        {busy ? "Sending…" : "Join the waiting list"}
      </button>
      <p className="text-xs text-center leading-relaxed" style={{ color: "rgba(181,175,164,0.7)" }}>
        We only use your email to send you an invite. You can ask us to remove it at any time.
      </p>
      <p className="text-xs text-center">
        <button type="button" onClick={onBack} className="underline" style={{ color: "rgba(181,175,164,0.8)" }}>
          Back to sign in
        </button>
      </p>
    </form>
  );
}
