// Check: the Fit screen never changes a value the user did not type.
// Run: node scripts/check-body-units.ts   (Node 22.18+ / 24 runs TypeScript directly)
// Bug it guards (DEV 2026-11-26): saving only a height change turned weight
// 55.0 into 54.9, chest 90.0 into 89.9, ... (cm -> in -> cm round trip).

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BODY_KEYS, fieldFromStored, fieldFromTyped, fieldInUnits, storedValue,
  heightFromStored, heightFromTypedCm, heightFromTypedFtIn, heightValue,
} from "../src/lib/bodyUnits.ts";
import type { BodyKey, BodyField } from "../src/lib/bodyUnits.ts";
import { MEASURE_KEYS, RANGES as SHARED_RANGES, inRange, rangeText, rangeError, helpText } from "../shared/bodyRanges.ts";
import type { RangeKey } from "../shared/bodyRanges.ts";

// Stored values as they come from the database (cm/kg, 1 decimal), incl. the DEV case.
const SAMPLES: Record<BodyKey, number>[] = [
  { weight_kg: 55.0, chest_cm: 90.0, waist_cm: 60.0, hips_cm: 90.0, inseam_cm: 76.0, shoulder_cm: 38.0 },
  { weight_kg: 54.9, chest_cm: 89.9, waist_cm: 59.9, hips_cm: 89.9, inseam_cm: 75.3, shoulder_cm: 41.7 },
  { weight_kg: 72.3, chest_cm: 101.6, waist_cm: 83.1, hips_cm: 97.4, inseam_cm: 81.2, shoulder_cm: 45.5 },
  { weight_kg: 30, chest_cm: 50, waist_cm: 40, hips_cm: 50, inseam_cm: 40, shoulder_cm: 30 },
  { weight_kg: 300, chest_cm: 200, waist_cm: 200, hips_cm: 220, inseam_cm: 120, shoulder_cm: 70 },
];

// Every 0.1 step in each field's allowed range.
const RANGES: Record<BodyKey, [number, number]> = {
  weight_kg: [30, 300], chest_cm: [50, 200], waist_cm: [40, 200],
  hips_cm: [50, 220], inseam_cm: [40, 120], shoulder_cm: [30, 70],
};

const load = (s: Record<BodyKey, number>, imperial: boolean) => {
  const out = {} as Record<BodyKey, BodyField>;
  for (const k of BODY_KEYS) out[k] = fieldFromStored(k, s[k], imperial);
  return out;
};
const send = (b: Record<BodyKey, BodyField>) => {
  const out = {} as Record<BodyKey, number | null>;
  for (const k of BODY_KEYS) out[k] = storedValue(b[k]);
  return out;
};
const switchAll = (b: Record<BodyKey, BodyField>, toImperial: boolean) => {
  const out = {} as Record<BodyKey, BodyField>;
  for (const k of BODY_KEYS) out[k] = fieldInUnits(k, b[k], toImperial);
  return out;
};

test("saving the form unchanged sends exactly the stored values (inches and cm)", () => {
  for (const s of SAMPLES) {
    assert.deepEqual(send(load(s, true)), s);
    assert.deepEqual(send(load(s, false)), s);
  }
});

test("every stored value in range survives loading in inches and saving", () => {
  for (const k of BODY_KEYS) {
    const [min, max] = RANGES[k];
    for (let t = min * 10; t <= max * 10; t++) {
      const v = t / 10;
      assert.equal(storedValue(fieldFromStored(k, v, true)), v, `${k} ${v}`);
    }
  }
});

test("switching units back and forth without typing sends exactly the stored values", () => {
  for (const s of SAMPLES) {
    let b = load(s, true);
    for (let i = 0; i < 6; i++) b = switchAll(b, i % 2 === 0 ? false : true);
    assert.deepEqual(send(b), s);
    b = load(s, false);
    for (let i = 0; i < 7; i++) b = switchAll(b, i % 2 === 0);
    assert.deepEqual(send(b), s);
  }
});

test("a typed value is converted once, rounded only at the end", () => {
  assert.equal(storedValue(fieldFromTyped("chest_cm", "35.4", true)), 89.9); // 89.916
  assert.equal(storedValue(fieldFromTyped("waist_cm", "23.65", true)), 60.1); // 60.071
  assert.equal(storedValue(fieldFromTyped("weight_kg", "121", true)), 54.9); // 54.884
  assert.equal(storedValue(fieldFromTyped("hips_cm", "90", false)), 90);
  assert.equal(storedValue(fieldFromTyped("hips_cm", "90,25", false)), 90.3);
  // Typed in inches, then switched back and forth: still the same value.
  let f = fieldFromTyped("chest_cm", "35.4", true);
  for (let i = 0; i < 5; i++) f = fieldInUnits("chest_cm", f, i % 2 === 0 ? false : true);
  assert.equal(storedValue(f), 89.9);
  // Cleared or not a number: nothing is sent.
  assert.equal(storedValue(fieldFromTyped("chest_cm", "", true)), null);
  assert.equal(storedValue(fieldFromTyped("chest_cm", ".", false)), null);
});

test("only the field the user typed changes", () => {
  const s = SAMPLES[0];
  const b = load(s, true);
  b.waist_cm = fieldFromTyped("waist_cm", "24", true); // 60.96
  assert.deepEqual(send(b), { ...s, waist_cm: 61 });
});

// ---- ranges: one source for form check, server check, error and (i) text ----

test("the form and server field lists are the same", () => {
  assert.deepEqual([...BODY_KEYS], [...MEASURE_KEYS]);
  // Range check on the stored value, like api/profile.ts.
  for (const k of BODY_KEYS) {
    // The 0.1-step sweep above uses the same ranges as the form and server.
    assert.deepEqual(RANGES[k], SHARED_RANGES[k], k);
    const [lo, hi] = SHARED_RANGES[k];
    assert.ok(inRange(k, lo) && inRange(k, hi) && !inRange(k, lo - 0.1) && !inRange(k, hi + 0.1), k);
  }
});

// Read the whole-number ends back out of a range text ("12–27 in", "4′0″–7′6″").
const ends = (t: string): [number, number] => {
  const ft = t.match(/(\d+)′(\d+)″–(\d+)′(\d+)″/);
  if (ft) return [Number(ft[1]) * 12 + Number(ft[2]), Number(ft[3]) * 12 + Number(ft[4])];
  const m = t.match(/([\d.]+)–([\d.]+)/);
  return [Number(m![1]), Number(m![2])];
};

test("every range shown in inches/lb is really accepted, and one step outside is refused", () => {
  for (const k of BODY_KEYS) {
    const [lo, hi] = ends(rangeText(k, true));
    const sent = (typed: number) => storedValue(fieldFromTyped(k, String(typed), true))!;
    assert.ok(inRange(k, sent(lo)) && inRange(k, sent(hi)), `${k} ${rangeText(k, true)}`);
    assert.ok(!inRange(k, sent(lo - 1)) && !inRange(k, sent(hi + 1)), `${k} outside`);
  }
  const [hlo, hhi] = ends(rangeText("height_cm", true));
  const h = (inches: number) => heightValue(heightFromTypedFtIn(String(Math.floor(inches / 12)), String(inches % 12)))!;
  assert.ok(inRange("height_cm", h(hlo)) && inRange("height_cm", h(hhi)), rangeText("height_cm", true));
  assert.ok(!inRange("height_cm", h(hlo - 1)) && !inRange("height_cm", h(hhi + 1)), "height outside");
});

test("the (i) text and the error repeat the same range, in the user's units", () => {
  const keys: RangeKey[] = ["height_cm", ...MEASURE_KEYS];
  for (const k of keys) {
    for (const imperial of [true, false]) {
      const r = rangeText(k, imperial);
      assert.ok(helpText(k, imperial).includes(`Range: ${r} (`), `${k} help`);
      assert.ok(rangeError(k, imperial).endsWith(`between ${r}.`), `${k} error`);
    }
  }
  assert.equal(rangeError("shoulder_cm", true), "Shoulder width must be between 12–27 in.");
  assert.equal(rangeError("shoulder_cm", false), "Shoulder width must be between 30–70 cm.");
  assert.equal(
    helpText("shoulder_cm", false),
    "From one shoulder tip to the other, across your back, not around your body. Range: 30–70 cm (12–27 in)."
  );
});

test("height: unchanged stored height is sent as stored, in ft/in and cm", () => {
  for (let cm = 120; cm <= 230; cm++) {
    assert.equal(heightValue(heightFromStored(cm)), cm, `height ${cm}`);
  }
  assert.equal(heightValue(heightFromStored(null)), null);
  assert.equal(heightValue(heightFromTypedCm("171")), 171);
  assert.equal(heightValue(heightFromTypedFtIn("5", "7")), 170); // 170.18
  assert.equal(heightValue(heightFromTypedFtIn("5", "")), 152); // 152.4
  assert.equal(heightValue(heightFromTypedFtIn("", "7")), null);
});
