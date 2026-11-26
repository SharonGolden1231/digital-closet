import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Page, Title, Label, Chip, ChipGroup, Primary, TextLink, ErrorNote, inputStyle } from "./ui";
import {
  AGE_BANDS, SHOPS_FOR, WEEKDAYS, WEEKENDS, STYLES, GOALS, BRAND_TIERS, COMMON_BRANDS,
  FIT_ISSUES, COLOR_SWATCHES,
} from "./options";
import {
  fieldFromStored, fieldFromTyped, fieldInUnits, storedValue,
  heightFromStored, heightFromTypedCm, heightFromTypedFtIn, heightValue as heightCm,
} from "../lib/bodyUnits";
import type { BodyKey, BodyField, HeightField } from "../lib/bodyUnits";
import { MEASURE_KEYS, LABELS, inRange, rangeError, helpText } from "../../shared/bodyRanges";
import type { RangeKey } from "../../shared/bodyRanges";
import type { Option } from "./options";
import {
  saveProfile, saveProfileAndMeasurements, deleteMeasurements, ApiError, EMPTY_PROFILE,
} from "../lib/account";
import type { StyleProfile, Measurements } from "../lib/account";
import { track } from "../lib/track";

// The intro questions: 7 short screens, tap answers, every screen skippable
// except the age check. Each "Next" saves what is on that screen, so nothing
// is lost if the person closes the app half way.
// From Settings, one screen can be opened on its own (startStep): "Save"
// then saves that screen and goes back.

export const STEPS = ["about", "shop", "week", "style", "goals", "brands", "fit"] as const;
export type Step = (typeof STEPS)[number];

// Names, ranges and (i) text come from shared/bodyRanges.ts (also used by the server).
const BODY_FIELDS: { key: BodyKey; label: string; imperial: string; metric: string }[] = MEASURE_KEYS.map((key) => ({
  key,
  label: LABELS[key],
  imperial: key === "weight_kg" ? "lb" : "in",
  metric: key === "weight_kg" ? "kg" : "cm",
}));

// (i) button: tap to open the explanation, tap again or anywhere else to close
// (works by tap on iPhone; no hover needed).
function InfoButton({ id, label, open, onToggle }: { id: string; label: string; open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      data-info={id}
      onClick={onToggle}
      aria-expanded={open}
      aria-label={"About " + label}
      className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold leading-none shrink-0"
      style={{
        border: "1px solid var(--mid-grey)",
        color: open ? "white" : "var(--mid-grey)",
        background: open ? "var(--emerald)" : "transparent",
      }}
    >
      i
    </button>
  );
}

function InfoText({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      data-info={id}
      role="note"
      className="text-xs rounded-lg px-2.5 py-2 leading-relaxed"
      style={{ background: "var(--success-bg)", color: "var(--emerald)" }}
    >
      {children}
    </p>
  );
}

const errorBorder = { ...inputStyle, border: "1.5px solid var(--error-ink)" };

function toggle(list: string[], id: string, max: number): string[] {
  if (list.includes(id)) return list.filter((x) => x !== id);
  if (list.length >= max) return list;
  return [...list, id];
}

function Many({
  options,
  value,
  max,
  onChange,
}: {
  options: Option[];
  value: string[];
  max: number;
  onChange: (v: string[]) => void;
}) {
  return (
    <ChipGroup>
      {options.map((o) => (
        <Chip
          key={o.id}
          label={o.label}
          selected={value.includes(o.id)}
          disabled={value.length >= max}
          onClick={() => onChange(toggle(value, o.id, max))}
        />
      ))}
    </ChipGroup>
  );
}

export function Onboarding({
  initial,
  initialMeasurements = null,
  initialBodyConsent = false,
  editing = false,
  startStep,
  onDone,
  onCancel,
}: {
  initial: StyleProfile | null;
  initialMeasurements?: Measurements | null;
  // The measurements consent is already given (and not withdrawn).
  initialBodyConsent?: boolean;
  editing?: boolean;
  // Editing one screen only (opened from Settings).
  startStep?: Step;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const single = editing && startStep !== undefined;
  const [p, setP] = useState<StyleProfile>({ ...EMPTY_PROFILE, ...(initial ?? {}) });
  const [stepIdx, setStepIdx] = useState(single ? STEPS.indexOf(startStep) : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [underage, setUnderage] = useState(false);
  const [brandInput, setBrandInput] = useState("");
  // Height and measurements share one unit switch; start with the saved units.
  const imperialStart = (initialMeasurements?.units ?? "imperial") === "imperial";
  const [heightUnit, setHeightUnit] = useState<"ft" | "cm">(imperialStart ? "ft" : "cm");
  // Each field keeps its exact cm/kg value: untouched values are saved as stored.
  const [height, setHeight] = useState<HeightField>(() => heightFromStored(p.height_cm));
  const [showBody, setShowBody] = useState(Boolean(initialMeasurements));
  const [body, setBody] = useState<Record<BodyKey, BodyField>>(() => {
    const out = {} as Record<BodyKey, BodyField>;
    for (const f of BODY_FIELDS) out[f.key] = fieldFromStored(f.key, initialMeasurements?.[f.key], imperialStart);
    return out;
  });
  // Already agreed earlier: the box starts ticked (it can still be unticked).
  const [bodyConsent, setBodyConsent] = useState(initialBodyConsent && Boolean(initialMeasurements));
  // Measurements are saved on the server (unticking the box then withdraws).
  const [hasSavedBody, setHasSavedBody] = useState(Boolean(initialMeasurements));
  // The field the last error is about (highlighted), and the open (i) text.
  const [badField, setBadField] = useState<RangeKey | null>(null);
  const [openInfo, setOpenInfo] = useState<RangeKey | null>(null);

  // Close the (i) text on a tap anywhere outside it or its button.
  useEffect(() => {
    if (!openInfo) return;
    const close = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (!t?.closest?.(`[data-info="${openInfo}"]`)) setOpenInfo(null);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [openInfo]);
  const toggleInfo = (k: RangeKey) => setOpenInfo((cur) => (cur === k ? null : k));

  const step: Step = STEPS[stepIdx];
  const set = (patch: Partial<StyleProfile>) => setP((prev) => ({ ...prev, ...patch }));

  const heightValue = (): number | null => heightCm(height);

  // One switch for height and measurements. Only the text changes; the exact
  // cm/kg values stay, so switching back and forth never changes a value.
  const switchUnits = () => {
    const toImperial = heightUnit !== "ft";
    setBody((prev) => {
      const out = { ...prev };
      for (const f of BODY_FIELDS) out[f.key] = fieldInUnits(f.key, prev[f.key], toImperial);
      return out;
    });
    setHeightUnit(toImperial ? "ft" : "cm");
  };

  // The fields each screen owns (only these are sent when it is saved).
  const fieldsFor = (s: Step): Partial<StyleProfile> => {
    switch (s) {
      case "about":
        return { first_name: p.first_name, adult_confirmed: p.adult_confirmed, age_band: p.age_band };
      case "shop":
        return { shops_for: p.shops_for };
      case "week":
        return { weekdays: p.weekdays, weekends: p.weekends };
      case "style":
        return { style_now: p.style_now, style_toward: p.style_toward, style_icon: p.style_icon };
      case "goals":
        return { goals: p.goals };
      case "brands":
        return { brand_tiers: p.brand_tiers, brands: p.brands };
      case "fit":
        return {
          height_cm: heightValue(),
          fit_issues: p.fit_issues,
          colors_love: p.colors_love,
          colors_avoid: p.colors_avoid,
        };
    }
  };

  // Fit screen: every typed value must be a number in its allowed range
  // (same ranges as the server). Returns the first problem, or null.
  const checkFit = (imperial: boolean): { field: RangeKey; message: string } | null => {
    const h = heightValue();
    const hTyped = heightUnit === "ft" ? height.ft.trim() !== "" || height.inch.trim() !== "" : height.cm.trim() !== "";
    if ((hTyped && h === null) || (h !== null && !inRange("height_cm", h))) {
      return { field: "height_cm", message: rangeError("height_cm", imperial) };
    }
    if (!showBody) return null;
    for (const f of BODY_FIELDS) {
      const v = storedValue(body[f.key]);
      const typed = body[f.key].text.trim() !== "";
      if ((typed && v === null) || (v !== null && !inRange(f.key, v))) {
        return { field: f.key, message: rangeError(f.key, imperial) };
      }
    }
    return null;
  };

  const next = async (skip = false) => {
    if (busy) return;
    setError("");
    setBadField(null);
    if (step === "about") {
      if (!p.adult_confirmed) {
        setError("Please confirm you are 18 or older to continue.");
        return;
      }
    }
    const finalStep = stepIdx === STEPS.length - 1;
    const last = single || finalStep;
    // Editing one screen does not re-stamp "onboarding completed".
    const completed = finalStep && !single;
    const imperial = heightUnit === "ft";
    if (step === "fit" && !skip) {
      const problem = checkFit(imperial);
      if (problem) {
        setError(problem.message);
        setBadField(problem.field);
        return;
      }
    }
    const bodyTyped = showBody && BODY_FIELDS.some((f) => body[f.key].text.trim() !== "");
    // Saved measurements + box unticked (or all fields cleared) = withdraw the
    // consent: that deletes the measurements and their history. Never
    // re-record consent while the box is unticked.
    const withdraw = !skip && step === "fit" && hasSavedBody && (!bodyConsent || !bodyTyped);
    const bodyFilled = !skip && step === "fit" && bodyTyped && !withdraw;
    if (bodyFilled && !bodyConsent) {
      setError("To save measurements, please tick the box to agree — or clear them.");
      return;
    }
    if (withdraw && !window.confirm("This deletes your measurements and their history. Continue?")) {
      setError("Nothing was saved. Tick the box to keep your measurements.");
      return;
    }
    setBusy(true);
    try {
      const fields = skip && step !== "about" ? {} : fieldsFor(step);
      if (withdraw) {
        // Records the consent as withdrawn and deletes current values + history.
        await deleteMeasurements();
        setHasSavedBody(false);
        setBodyConsent(false);
        setBody((prev) => {
          const out = { ...prev };
          for (const f of BODY_FIELDS) out[f.key] = { text: "", exact: null };
          return out;
        });
        if (Object.keys(fields).length > 0 || completed) await saveProfile(fields, completed);
      } else if (bodyFilled) {
        const m: Measurements = {
          weight_kg: storedValue(body.weight_kg),
          chest_cm: storedValue(body.chest_cm),
          waist_cm: storedValue(body.waist_cm),
          hips_cm: storedValue(body.hips_cm),
          inseam_cm: storedValue(body.inseam_cm),
          shoulder_cm: storedValue(body.shoulder_cm),
          units: imperial ? "imperial" : "metric",
        };
        // Height and measurements together: one history entry.
        await saveProfileAndMeasurements(fields, m, completed);
        setHasSavedBody(true);
      } else if (Object.keys(fields).length > 0 || completed) {
        await saveProfile(fields, completed);
      }
      track("onboarding_step", { step, skipped: skip, editing });
      if (last) {
        if (!editing && completed) track("onboarding_done");
        onDone();
        return;
      }
      setStepIdx((i) => i + 1);
    } catch (e) {
      if (e instanceof ApiError && e.field && e.field in LABELS) {
        // The server names the field: same text and range as the form, in the user's units.
        const f = e.field as RangeKey;
        setError(rangeError(f, imperial));
        setBadField(f);
      } else {
        setError(e instanceof ApiError ? e.message : "Couldn't save — check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  if (underage) {
    return (
      <Page>
        <Title sub="Vestry is for people aged 18 and over for now. Thank you for your interest.">
          Sorry — not yet
        </Title>
        {onCancel && <TextLink onClick={onCancel}>Back</TextLink>}
      </Page>
    );
  }

  const addBrand = (name: string) => {
    const t = name.trim().slice(0, 40);
    if (!t) return;
    if (p.brands.some((b) => b.toLowerCase() === t.toLowerCase())) return;
    if (p.brands.length >= 20) {
      setError("Up to 20 brands.");
      return;
    }
    set({ brands: [...p.brands, t] });
    setBrandInput("");
  };

  return (
    <Page>
      <div className="flex items-center gap-1.5" aria-label={"Step " + (stepIdx + 1) + " of " + STEPS.length}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full"
            style={{ background: i <= stepIdx ? "var(--emerald)" : "var(--warm-grey)" }}
          />
        ))}
      </div>

      {step === "about" && (
        <>
          <Title sub="A few quick taps so your stylist gets you from day one.">Welcome to your closet</Title>
          <div className="space-y-2">
            <Label>What should we call you?</Label>
            <input
              value={p.first_name ?? ""}
              onChange={(e) => set({ first_name: e.target.value.slice(0, 40) })}
              placeholder="First name"
              autoComplete="given-name"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>
          <div className="space-y-2">
            <Label>Age</Label>
            <label className="flex items-center gap-2.5 text-sm" style={{ color: "var(--ink)" }}>
              <input
                type="checkbox"
                checked={p.adult_confirmed}
                onChange={(e) => set({ adult_confirmed: e.target.checked })}
                className="w-4 h-4"
              />
              I am 18 or older
            </label>
            <ChipGroup>
              {AGE_BANDS.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={p.age_band === o.id}
                  onClick={() => set({ age_band: p.age_band === o.id ? null : o.id })}
                />
              ))}
            </ChipGroup>
            {!editing && (
              <TextLink onClick={() => setUnderage(true)}>I'm under 18</TextLink>
            )}
          </div>
        </>
      )}

      {step === "shop" && (
        <>
          <Title sub="So we suggest the right categories.">I mostly shop…</Title>
          <ChipGroup>
            {SHOPS_FOR.map((o) => (
              <Chip
                key={o.id}
                label={o.label}
                selected={p.shops_for === o.id}
                onClick={() => set({ shops_for: p.shops_for === o.id ? null : o.id })}
              />
            ))}
          </ChipGroup>
        </>
      )}

      {step === "week" && (
        <>
          <Title sub="Your week decides which basics matter most.">What does your week look like?</Title>
          <div className="space-y-2">
            <Label hint="Pick up to 4 — work, evenings, workouts">Weekdays</Label>
            <Many options={WEEKDAYS} value={p.weekdays} max={4} onChange={(v) => set({ weekdays: v })} />
          </div>
          <div className="space-y-2">
            <Label hint="Pick any">Weekends</Label>
            <Many options={WEEKENDS} value={p.weekends} max={WEEKENDS.length} onChange={(v) => set({ weekends: v })} />
          </div>
        </>
      )}

      {step === "style" && (
        <>
          <Title>Your style</Title>
          <div className="space-y-2">
            <Label hint="Pick up to 3">How you dress today</Label>
            <Many options={STYLES} value={p.style_now} max={3} onChange={(v) => set({ style_now: v })} />
          </div>
          <div className="space-y-2">
            <Label hint="Optional, up to 3">Where you'd like to go</Label>
            <Many options={STYLES} value={p.style_toward} max={3} onChange={(v) => set({ style_toward: v })} />
          </div>
          <div className="space-y-2">
            <Label hint="Optional — a celebrity, influencer or anyone you admire">Someone whose style you love</Label>
            <input
              value={p.style_icon ?? ""}
              onChange={(e) => set({ style_icon: e.target.value.slice(0, 80) })}
              placeholder="e.g. Hailey Bieber"
              className="w-full px-4 py-3 rounded-xl text-sm focus:outline-none"
              style={inputStyle}
            />
          </div>
        </>
      )}

      {step === "goals" && (
        <>
          <Title sub="Pick up to 3 — this decides what your stylist focuses on.">What would help you most?</Title>
          <Many options={GOALS} value={p.goals} max={3} onChange={(v) => set({ goals: v })} />
        </>
      )}

      {step === "brands" && (
        <>
          <Title sub="Helps us suggest pieces that fit how you shop.">Where do you shop?</Title>
          <div className="space-y-2">
            <Label hint="Pick any">Kind of brands</Label>
            <Many
              options={BRAND_TIERS}
              value={p.brand_tiers}
              max={BRAND_TIERS.length}
              onChange={(v) => set({ brand_tiers: v })}
            />
          </div>
          <div className="space-y-2">
            <Label hint="Tap your favourites or add your own (up to 20)">Brands</Label>
            <ChipGroup>
              {Array.from(new Set([...COMMON_BRANDS, ...p.brands])).map((b) => (
                <Chip
                  key={b}
                  label={b}
                  selected={p.brands.includes(b)}
                  disabled={p.brands.length >= 20}
                  onClick={() =>
                    set({ brands: p.brands.includes(b) ? p.brands.filter((x) => x !== b) : [...p.brands, b] })
                  }
                />
              ))}
            </ChipGroup>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                addBrand(brandInput);
              }}
            >
              <input
                value={brandInput}
                onChange={(e) => setBrandInput(e.target.value)}
                placeholder="Add another brand"
                className="flex-1 px-4 py-2.5 rounded-xl text-sm focus:outline-none"
                style={inputStyle}
              />
              <button
                type="submit"
                className="px-4 rounded-xl text-sm font-medium"
                style={{ background: "var(--gold)", color: "var(--emerald)" }}
              >
                Add
              </button>
            </form>
          </div>
        </>
      )}

      {step === "fit" && (
        <>
          <Title sub="All optional. Your sizes come from the labels you scan.">Fit and colours</Title>
          <p
            className="text-xs rounded-xl px-3 py-2 leading-relaxed"
            style={{ background: "var(--success-bg)", color: "var(--emerald)" }}
          >
            Skip anything you like — you can add or change all of this later in Settings, and soon simply by telling
            your stylist.
          </p>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Height</Label>
              <InfoButton
                id="height_cm"
                label="Height"
                open={openInfo === "height_cm"}
                onToggle={() => toggleInfo("height_cm")}
              />
            </div>
            {openInfo === "height_cm" && <InfoText id="height_cm">{helpText("height_cm", heightUnit === "ft")}</InfoText>}
            <div className="flex gap-2 items-center flex-wrap">
              {heightUnit === "ft" ? (
                <>
                  <span className="flex items-center gap-1.5">
                    <input
                      inputMode="numeric"
                      aria-label="Height, feet"
                      value={height.ft}
                      onChange={(e) => setHeight(heightFromTypedFtIn(e.target.value.replace(/\D/g, "").slice(0, 1), height.inch))}
                      className="w-14 px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                      style={badField === "height_cm" ? errorBorder : inputStyle}
                    />
                    <span className="text-sm" style={{ color: "var(--mid-grey)" }}>ft</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <input
                      inputMode="numeric"
                      aria-label="Height, inches"
                      value={height.inch}
                      onChange={(e) => setHeight(heightFromTypedFtIn(height.ft, e.target.value.replace(/\D/g, "").slice(0, 2)))}
                      className="w-14 px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                      style={badField === "height_cm" ? errorBorder : inputStyle}
                    />
                    <span className="text-sm" style={{ color: "var(--mid-grey)" }}>in</span>
                  </span>
                </>
              ) : (
                <span className="flex items-center gap-1.5">
                  <input
                    inputMode="numeric"
                    aria-label="Height, cm"
                    value={height.cm}
                    onChange={(e) => setHeight(heightFromTypedCm(e.target.value.replace(/\D/g, "").slice(0, 3)))}
                    className="w-20 px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                    style={badField === "height_cm" ? errorBorder : inputStyle}
                  />
                  <span className="text-sm" style={{ color: "var(--mid-grey)" }}>cm</span>
                </span>
              )}
              <TextLink onClick={switchUnits}>
                {heightUnit === "ft" ? "Use cm / kg" : "Use ft / in / lb"}
              </TextLink>
            </div>
          </div>
          <div className="space-y-2">
            <Label hint="Optional">Body measurements</Label>
            {!showBody ? (
              <div className="space-y-2">
                <p className="text-xs leading-relaxed" style={{ color: "var(--mid-grey)" }}>
                  Rather not share these? No problem — once your closet is in, you can mark pieces that fit you
                  perfectly and we'll learn your fit from them.
                </p>
                <TextLink onClick={() => setShowBody(true)}>Add measurements</TextLink>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  {BODY_FIELDS.map((f) => {
                    const unit = heightUnit === "ft" ? f.imperial : f.metric;
                    return (
                      <div key={f.key} className="text-xs space-y-1" style={{ color: "var(--mid-grey)" }}>
                        <div className="flex items-center gap-1.5">
                          <label htmlFor={"m-" + f.key}>
                            {f.label} ({unit})
                          </label>
                          <InfoButton
                            id={f.key}
                            label={f.label}
                            open={openInfo === f.key}
                            onToggle={() => toggleInfo(f.key)}
                          />
                        </div>
                        <span className="flex items-center gap-1.5">
                          <input
                            id={"m-" + f.key}
                            inputMode="decimal"
                            value={body[f.key].text}
                            onChange={(e) => {
                              const typed = e.target.value.replace(/[^0-9.,]/g, "").slice(0, 5);
                              setBody((prev) => ({ ...prev, [f.key]: fieldFromTyped(f.key, typed, heightUnit === "ft") }));
                            }}
                            aria-invalid={badField === f.key}
                            className="w-full min-w-0 px-3 py-2.5 rounded-xl text-sm focus:outline-none"
                            style={badField === f.key ? errorBorder : inputStyle}
                          />
                          <span className="text-sm w-5 shrink-0">{unit}</span>
                        </span>
                        {openInfo === f.key && <InfoText id={f.key}>{helpText(f.key, heightUnit === "ft")}</InfoText>}
                      </div>
                    );
                  })}
                </div>
                <label className="flex items-start gap-2.5 text-xs leading-relaxed" style={{ color: "var(--ink)" }}>
                  <input
                    type="checkbox"
                    checked={bodyConsent}
                    onChange={(e) => setBodyConsent(e.target.checked)}
                    className="w-4 h-4 mt-0.5"
                  />
                  <span>
                    I agree that Vestry stores these measurements and uses them (including with our AI provider) only
                    to suggest fit and sizes. They are never shared with anyone else, and I can delete them at any time
                    in Settings.
                  </span>
                </label>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label hint="Where clothes usually don't fit you">Fit</Label>
            <ChipGroup>
              {FIT_ISSUES.map((o) => (
                <Chip
                  key={o.id}
                  label={o.label}
                  selected={p.fit_issues.includes(o.id)}
                  onClick={() => {
                    if (o.id === "none") set({ fit_issues: p.fit_issues.includes("none") ? [] : ["none"] });
                    else set({ fit_issues: toggle(p.fit_issues.filter((x) => x !== "none"), o.id, 6) });
                  }}
                />
              ))}
            </ChipGroup>
          </div>
          <div className="space-y-2">
            <Label hint="Up to 12">Colours you love</Label>
            <ChipGroup>
              {Object.entries(COLOR_SWATCHES).map(([name, hex]) => (
                <Chip
                  key={name}
                  label={name}
                  swatch={hex}
                  selected={p.colors_love.includes(name)}
                  disabled={p.colors_love.length >= 12}
                  onClick={() =>
                    set({
                      colors_love: toggle(p.colors_love, name, 12),
                      colors_avoid: p.colors_avoid.filter((c) => c !== name),
                    })
                  }
                />
              ))}
            </ChipGroup>
          </div>
          <div className="space-y-2">
            <Label hint="Up to 12">Colours you avoid</Label>
            <ChipGroup>
              {Object.entries(COLOR_SWATCHES).map(([name, hex]) => (
                <Chip
                  key={name}
                  label={name}
                  swatch={hex}
                  selected={p.colors_avoid.includes(name)}
                  disabled={p.colors_avoid.length >= 12}
                  onClick={() =>
                    set({
                      colors_avoid: toggle(p.colors_avoid, name, 12),
                      colors_love: p.colors_love.filter((c) => c !== name),
                    })
                  }
                />
              ))}
            </ChipGroup>
          </div>
        </>
      )}

      <ErrorNote>{error}</ErrorNote>

      <div className="space-y-3">
        <Primary onClick={() => next(false)} disabled={busy}>
          {busy
            ? "Saving…"
            : single
              ? "Save"
              : stepIdx === STEPS.length - 1
                ? editing
                  ? "Save"
                  : "Finish"
                : "Next"}
        </Primary>
        <div className="flex items-center justify-between">
          {single && onCancel ? (
            <TextLink onClick={onCancel}>Cancel</TextLink>
          ) : stepIdx > 0 ? (
            <TextLink onClick={() => setStepIdx((i) => i - 1)}>Back</TextLink>
          ) : editing && onCancel ? (
            <TextLink onClick={onCancel}>Cancel</TextLink>
          ) : (
            <span />
          )}
          {step !== "about" && !single && <TextLink onClick={() => next(true)}>Skip</TextLink>}
        </div>
      </div>
    </Page>
  );
}
