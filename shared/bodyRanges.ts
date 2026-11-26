// ONE source for height and body-measurement names, allowed ranges and the
// (i) help text. Used by the Fit screen (form check and (i) text) and by
// api/profile.ts (server check and error message), so they never disagree.
// The cm/kg ranges match the database checks (supabase/migrations).
// No imports: Node, Vite and the server all load this file directly.

export const MEASURE_KEYS = ["weight_kg", "chest_cm", "waist_cm", "hips_cm", "inseam_cm", "shoulder_cm"] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];
export type RangeKey = MeasureKey | "height_cm";

// Stored units: kg for weight, cm for everything else.
// Height is style_profiles.height_cm (whole cm, database check 120-230).
export const RANGES: Record<RangeKey, [number, number]> = {
  height_cm: [120, 230],
  weight_kg: [30, 300],
  chest_cm: [50, 200],
  waist_cm: [40, 200],
  hips_cm: [50, 220],
  inseam_cm: [40, 120],
  shoulder_cm: [30, 70],
};

export const LABELS: Record<RangeKey, string> = {
  height_cm: "Height",
  weight_kg: "Weight",
  chest_cm: "Chest / bust",
  waist_cm: "Waist",
  hips_cm: "Hips",
  inseam_cm: "Inseam",
  shoulder_cm: "Shoulder width",
};

// What to measure and how (the range is added from RANGES).
export const HOW_TO: Record<RangeKey, string> = {
  height_cm: "Stand straight without shoes.",
  weight_kg: "Your current weight.",
  chest_cm: "Around the fullest part of your chest, tape level under your arms.",
  waist_cm: "Around the narrowest part of your waist, usually just above the belly button.",
  hips_cm: "Around the fullest part of your hips and seat.",
  inseam_cm: "Inside of your leg, from the crotch to the ankle bone.",
  shoulder_cm: "From one shoulder tip to the other, across your back, not around your body.",
};

const LB_PER_KG = 2.20462;
const CM_PER_IN = 2.54;

// Is a stored value (kg/cm, as sent to the server) allowed?
export function inRange(key: RangeKey, stored: number): boolean {
  const [min, max] = RANGES[key];
  return Number.isFinite(stored) && stored >= min && stored <= max;
}

const ftIn = (inches: number) => `${Math.floor(inches / 12)}′${inches % 12}″`;

// The range in the user's units. Imperial ends are rounded INWARD to whole
// numbers, so every value shown as allowed is really accepted.
export function rangeText(key: RangeKey, imperial: boolean): string {
  const [min, max] = RANGES[key];
  if (!imperial) return `${min}–${max} ${key === "weight_kg" ? "kg" : "cm"}`;
  if (key === "weight_kg") return `${Math.ceil(min * LB_PER_KG)}–${Math.floor(max * LB_PER_KG)} lb`;
  const lo = Math.ceil(min / CM_PER_IN);
  const hi = Math.floor(max / CM_PER_IN);
  if (key === "height_cm") return `${ftIn(lo)}–${ftIn(hi)}`;
  return `${lo}–${hi} in`;
}

// (i) text: how to measure, then the range in the user's units (other units in brackets).
export function helpText(key: RangeKey, imperial: boolean): string {
  return `${HOW_TO[key]} Range: ${rangeText(key, imperial)} (${rangeText(key, !imperial)}).`;
}

// Error for a value out of range, in the user's units.
export function rangeError(key: RangeKey, imperial: boolean): string {
  return `${LABELS[key]} must be between ${rangeText(key, imperial)}.`;
}
