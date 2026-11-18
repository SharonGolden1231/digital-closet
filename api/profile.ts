import { verifyUser } from "./_lib/gate.js";
import { userClient, COLOR_HEX } from "./_lib/closet.js";

// The signed-in user's intro answers (style profile), optional body
// measurements and admin flag.
//   GET  -> { profile | null, measurements | null, bodyConsent, isAdmin }
//   POST {answers, completed?: boolean}       -> save answers (partial allowed)
//   POST {measurements: {...}, bodyConsent: true} -> record consent, save numbers
//   POST {measurements: null}                 -> withdraw consent and DELETE them
// Everything runs AS THE USER: row-level security only ever lets people read
// and write their own row. Values are checked here AND by the database.

const AGE_BANDS = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"];
const SHOPS_FOR = ["womenswear", "menswear", "both"];
const WEEKDAYS = [
  "office_formal", "business_casual", "creative", "remote",
  "on_feet", "student", "home_with_kids", "other",
];
const WEEKENDS = ["errands", "outdoors_sport", "going_out", "events", "family"];
const STYLES = ["classic", "minimal", "relaxed", "polished", "edgy", "romantic", "sporty", "bold"];
const GOALS = [
  "dress_faster", "wear_more_closet", "put_together",
  "buy_smarter", "find_style", "new_stage",
];
const BRAND_TIERS = ["fast_fashion", "mid_market", "premium", "luxury", "resale_vintage"];
const FIT_ISSUES = ["waist", "hips", "chest", "shoulders", "length", "sleeves", "none"];
const COLORS = Object.keys(COLOR_HEX);

const COLUMNS =
  "first_name, adult_confirmed, age_band, shops_for, weekdays, weekends, style_now, style_toward, style_icon, goals, brand_tiers, brands, height_cm, fit_issues, colors_love, colors_avoid, onboarding_completed_at";

const BODY_CONSENT_VERSION = "body-2026-11-v1";
const BODY_FIELDS: Record<string, [number, number]> = {
  weight_kg: [30, 300],
  chest_cm: [50, 200],
  waist_cm: [40, 200],
  hips_cm: [50, 220],
  inseam_cm: [40, 120],
};

class Invalid extends Error {}

// Body numbers arrive in kg / cm (the app converts). Empty means "not given".
export function buildMeasurements(m: any): Record<string, unknown> {
  if (!m || typeof m !== "object" || Array.isArray(m)) throw new Invalid("measurements");
  const row: Record<string, unknown> = {};
  for (const [field, [min, max]] of Object.entries(BODY_FIELDS)) {
    const v = m[field];
    if (v === null || v === undefined || v === "") {
      row[field] = null;
      continue;
    }
    const n = Math.round(Number(v) * 10) / 10;
    if (!Number.isFinite(n) || n < min || n > max) throw new Invalid(field);
    row[field] = n;
  }
  if (m.units !== "imperial" && m.units !== "metric") throw new Invalid("units");
  row.units = m.units;
  if (Object.keys(BODY_FIELDS).every((f) => row[f] === null)) throw new Invalid("measurements");
  return row;
}

function cleanText(v: unknown, max: number, field: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Invalid(field);
  // No control characters; collapse spaces.
  const t = v.replace(/[\u0000-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (t.length === 0) return null;
  if (t.length > max) throw new Invalid(field);
  return t;
}

function pickOne(v: unknown, allowed: string[], field: string): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !allowed.includes(v)) throw new Invalid(field);
  return v;
}

function pickMany(v: unknown, allowed: string[], max: number, field: string): string[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) throw new Invalid(field);
  const out = Array.from(new Set(v.map((x) => String(x))));
  if (out.length > max || out.some((x) => !allowed.includes(x))) throw new Invalid(field);
  return out;
}

function freeList(v: unknown, maxItems: number, maxLen: number, field: string): string[] {
  if (v === null || v === undefined) return [];
  if (!Array.isArray(v)) throw new Invalid(field);
  const out: string[] = [];
  for (const x of v) {
    const t = cleanText(x, maxLen, field);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
  }
  if (out.length > maxItems) throw new Invalid(field);
  return out;
}

// Only the fields present in the request are changed.
export function buildUpdate(answers: any): Record<string, unknown> {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) throw new Invalid("answers");
  const row: Record<string, unknown> = {};
  const has = (k: string) => Object.prototype.hasOwnProperty.call(answers, k);

  if (has("first_name")) row.first_name = cleanText(answers.first_name, 40, "first_name");
  if (has("adult_confirmed")) {
    if (typeof answers.adult_confirmed !== "boolean") throw new Invalid("adult_confirmed");
    row.adult_confirmed = answers.adult_confirmed;
  }
  if (has("age_band")) row.age_band = pickOne(answers.age_band, AGE_BANDS, "age_band");
  if (has("shops_for")) row.shops_for = pickOne(answers.shops_for, SHOPS_FOR, "shops_for");
  if (has("weekdays")) row.weekdays = pickMany(answers.weekdays, WEEKDAYS, 2, "weekdays");
  if (has("weekends")) row.weekends = pickMany(answers.weekends, WEEKENDS, WEEKENDS.length, "weekends");
  if (has("style_now")) row.style_now = pickMany(answers.style_now, STYLES, 3, "style_now");
  if (has("style_toward")) row.style_toward = pickMany(answers.style_toward, STYLES, 3, "style_toward");
  if (has("style_icon")) row.style_icon = cleanText(answers.style_icon, 80, "style_icon");
  if (has("goals")) row.goals = pickMany(answers.goals, GOALS, 2, "goals");
  if (has("brand_tiers")) row.brand_tiers = pickMany(answers.brand_tiers, BRAND_TIERS, BRAND_TIERS.length, "brand_tiers");
  if (has("brands")) row.brands = freeList(answers.brands, 20, 40, "brands");
  if (has("height_cm")) {
    const h = answers.height_cm;
    if (h === null || h === "" || h === undefined) row.height_cm = null;
    else {
      const n = Number(h);
      if (!Number.isInteger(n) || n < 120 || n > 230) throw new Invalid("height_cm");
      row.height_cm = n;
    }
  }
  if (has("fit_issues")) {
    const f = pickMany(answers.fit_issues, FIT_ISSUES, FIT_ISSUES.length, "fit_issues");
    // "none" means none: it cannot be combined with a body zone.
    row.fit_issues = f.includes("none") ? ["none"] : f;
  }
  if (has("colors_love")) row.colors_love = pickMany(answers.colors_love, COLORS, 12, "colors_love");
  if (has("colors_avoid")) row.colors_avoid = pickMany(answers.colors_avoid, COLORS, 12, "colors_avoid");

  const love = (row.colors_love as string[] | undefined) ?? [];
  const avoid = (row.colors_avoid as string[] | undefined) ?? [];
  if (love.some((c) => avoid.includes(c))) throw new Invalid("colors");
  return row;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const auth = await verifyUser(req, res);
    if (!auth) return;
    const db = userClient(auth.token);
    if (!db) {
      console.error("profile: Supabase server settings are missing");
      return res.status(500).json({ error: "Service unavailable" });
    }

    if (req.method === "GET") {
      const [style, prof, body, consent] = await Promise.all([
        db.from("style_profiles").select(COLUMNS).eq("user_id", auth.userId).maybeSingle(),
        db.from("profiles").select("is_admin").eq("id", auth.userId).maybeSingle(),
        db
          .from("body_measurements")
          .select("weight_kg, chest_cm, waist_cm, hips_cm, inseam_cm, units")
          .eq("user_id", auth.userId)
          .maybeSingle(),
        db
          .from("consent_records")
          .select("granted")
          .eq("consent_type", "body_measurements")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (style.error || prof.error || body.error || consent.error) {
        console.error(
          "profile load failed:",
          style.error?.message,
          prof.error?.message,
          body.error?.message,
          consent.error?.message
        );
        return res.status(500).json({ error: "Couldn't load your profile." });
      }
      return res.status(200).json({
        profile: style.data ?? null,
        measurements: body.data ?? null,
        bodyConsent: (consent.data as any)?.granted === true,
        isAdmin: (prof.data as any)?.is_admin === true,
      });
    }

    const body = req.body && typeof req.body === "object" ? req.body : {};

    // ---- body measurements (sensitive: separate consent) ----
    if (Object.prototype.hasOwnProperty.call(body, "measurements")) {
      if (body.measurements === null) {
        // Withdraw: record the decision, then delete the numbers.
        const { error: cErr } = await db.rpc("record_consent", {
          p_type: "body_measurements",
          p_version: BODY_CONSENT_VERSION,
          p_granted: false,
        });
        if (cErr) {
          console.error("body consent withdraw failed:", cErr.message);
          return res.status(500).json({ error: "Couldn't save your choice." });
        }
        const { error: dErr } = await db.from("body_measurements").delete().eq("user_id", auth.userId);
        if (dErr) {
          console.error("body delete failed:", dErr.message);
          return res.status(500).json({ error: "Couldn't delete your measurements." });
        }
        return res.status(200).json({ ok: true });
      }
      if (body.bodyConsent !== true) {
        return res.status(400).json({ error: "Please tick the box to agree before saving measurements.", field: "bodyConsent" });
      }
      let m: Record<string, unknown>;
      try {
        m = buildMeasurements(body.measurements);
      } catch (e) {
        if (e instanceof Invalid) {
          return res.status(400).json({ error: "Please check your measurements.", field: e.message });
        }
        throw e;
      }
      const { error: cErr } = await db.rpc("record_consent", {
        p_type: "body_measurements",
        p_version: BODY_CONSENT_VERSION,
        p_granted: true,
      });
      if (cErr) {
        console.error("body consent failed:", cErr.message);
        return res.status(500).json({ error: "Couldn't save your choice." });
      }
      const { error: bErr } = await db
        .from("body_measurements")
        .upsert({ user_id: auth.userId, ...m }, { onConflict: "user_id" });
      if (bErr) {
        console.error("body save failed:", bErr.code, bErr.message);
        return res.status(500).json({ error: "Couldn't save your measurements." });
      }
      return res.status(200).json({ ok: true });
    }

    let row: Record<string, unknown>;
    try {
      row = buildUpdate(body.answers);
    } catch (e) {
      if (e instanceof Invalid) {
        return res.status(400).json({ error: "Please check your answers.", field: e.message });
      }
      throw e;
    }

    if (body.completed === true) {
      // Finishing requires the age check: the pilot is 18+ only.
      const adult =
        row.adult_confirmed ??
        (
          await db.from("style_profiles").select("adult_confirmed").eq("user_id", auth.userId).maybeSingle()
        ).data?.adult_confirmed;
      if (adult !== true) {
        return res.status(400).json({ error: "Vestry is for people aged 18 and over.", field: "adult_confirmed" });
      }
      row.onboarding_completed_at = new Date().toISOString();
    }

    const { error } = await db
      .from("style_profiles")
      .upsert({ user_id: auth.userId, ...row }, { onConflict: "user_id" });
    if (error) {
      console.error("profile save failed:", error.code, error.message);
      return res.status(500).json({ error: "Couldn't save your answers." });
    }
    return res.status(200).json({ ok: true });
  } catch (error: any) {
    console.error("profile error:", error?.message);
    return res.status(500).json({ error: "Service unavailable" });
  }
}
