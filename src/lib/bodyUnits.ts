// Height and body measurements on the Fit screen: what is shown (cm/kg or
// ft-in/in/lb) and what is saved (always cm/kg, 1 decimal; height whole cm).
//
// Rule: each field keeps its EXACT value in cm/kg next to the text on screen.
// - A field the user did not touch keeps the stored value, so saving or
//   switching units never changes it (no cm -> in -> cm round trip).
// - A typed value is converted to cm/kg once, at full precision; it is
//   rounded only when saved.
// Switching units only changes the text; the exact value stays the same.
// No imports: scripts/check-body-units.ts runs this file directly in Node.

export const BODY_KEYS = ["weight_kg", "chest_cm", "waist_cm", "hips_cm", "inseam_cm", "shoulder_cm"] as const;
export type BodyKey = (typeof BODY_KEYS)[number];

const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

export type BodyField = { text: string; exact: number | null };

const round1 = (n: number) => Math.round(n * 10) / 10;

// Text for an exact cm/kg value in the chosen units.
function display(key: BodyKey, exact: number, imperial: boolean): string {
  if (!imperial) return String(round1(exact));
  return key === "weight_kg" ? String(Math.round(exact * LB_PER_KG)) : String(round1(exact / CM_PER_IN));
}

export function fieldFromStored(key: BodyKey, stored: number | null | undefined, imperial: boolean): BodyField {
  if (stored === null || stored === undefined) return { text: "", exact: null };
  const exact = Number(stored);
  return { text: display(key, exact, imperial), exact };
}

// What the user typed, in the units on screen.
export function fieldFromTyped(key: BodyKey, text: string, imperial: boolean): BodyField {
  const n = parseFloat(text.replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return { text, exact: null };
  const exact = !imperial ? n : key === "weight_kg" ? n / LB_PER_KG : n * CM_PER_IN;
  return { text, exact };
}

// Same value, other units (no change to the exact value).
export function fieldInUnits(key: BodyKey, f: BodyField, imperial: boolean): BodyField {
  if (f.exact === null) return f;
  return { text: display(key, f.exact, imperial), exact: f.exact };
}

// The value sent to the server: cm/kg, 1 decimal.
export function storedValue(f: BodyField): number | null {
  return f.exact === null ? null : round1(f.exact);
}

// ---- height (whole cm, as style_profiles stores it) ----

export type HeightField = { ft: string; inch: string; cm: string; exact: number | null };

function ftIn(exact: number): { ft: string; inch: string } {
  const total = Math.round(exact / CM_PER_IN);
  return { ft: String(Math.floor(total / 12)), inch: String(total % 12) };
}

export function heightFromStored(cm: number | null | undefined): HeightField {
  if (cm === null || cm === undefined || !Number.isFinite(Number(cm))) return { ft: "", inch: "", cm: "", exact: null };
  const exact = Number(cm);
  return { ...ftIn(exact), cm: String(Math.round(exact)), exact };
}

export function heightFromTypedCm(cm: string): HeightField {
  const n = parseInt(cm, 10);
  if (!Number.isFinite(n) || n <= 0) return { ft: "", inch: "", cm, exact: null };
  return { ...ftIn(n), cm, exact: n };
}

export function heightFromTypedFtIn(ft: string, inch: string): HeightField {
  const f = parseInt(ft, 10);
  const i = parseInt(inch || "0", 10);
  if (!Number.isFinite(f) || f <= 0) return { ft, inch, cm: "", exact: null };
  const exact = (f * 12 + (Number.isFinite(i) ? i : 0)) * CM_PER_IN;
  return { ft, inch, cm: String(Math.round(exact)), exact };
}

// The value sent to the server: whole cm.
export function heightValue(h: HeightField): number | null {
  return h.exact === null ? null : Math.round(h.exact);
}
