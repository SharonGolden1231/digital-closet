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
