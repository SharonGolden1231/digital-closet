// Turns what a tag prints about size into words a user understands.
// No conversion tables and no brand rules: the AI reports the size as printed
// (size_printed + size_system) and any body code's numbers (body_fit); this
// file only formats them. A body code (e.g. 165/84A) is shown as the body it
// fits, never as a letter size.

export type SizeUnits = "metric" | "imperial";

export type TagSize = {
  size_raw?: string | null;
  size_decoded?: string | null;
  size_printed?: string | null;
  size_system?: string | null;
  size_equivalents?: ({ system?: string | null; value?: string | null } | string)[] | null;
  size_evidence?: string | null;
  body_fit?: { height_cm?: number | null; chest_cm?: number | null; waist_cm?: number | null } | null;
};

export type SizeInfo = {
  // The main size as printed, with its system when that helps ("S", "EU 38", "W32 L34").
  main: string | null;
  // Other sizes printed on the label ("US 6 · UK 10"), or null.
  also: string | null;
  // The body a body code fits, in the user's units, or null.
  fits: string | null;
};

// GB/T body codes: height cm / chest-or-waist cm, optional body-shape letter.
const BODY_CODE = /(\d{3})\s*\/\s*(\d{2,3})\s*[A-Z]?/i;

// Systems whose values read on their own; the others get the system in front.
const PLAIN_SYSTEMS = ["", "letter", "waist_length", "kids", "shoe", "other"];
const SYSTEM_LABEL: Record<string, string> = { MX: "MEX" };

function withSystem(value: string, system: string | null | undefined): string {
  const v = value.trim();
  const sys = (system || "").trim();
  if (!v) return "";
  if (PLAIN_SYSTEMS.includes(sys.toLowerCase())) return v;
  const label = SYSTEM_LABEL[sys.toUpperCase()] || sys.toUpperCase();
  // Already printed with its system ("EU 38"): keep as is.
  if (v.toUpperCase().startsWith(label) || v.toUpperCase().startsWith(sys.toUpperCase())) return v;
  return label + " " + v;
}

function isBodyCode(s: string): boolean {
  return BODY_CODE.test(s) && s.replace(BODY_CODE, "").replace(/^\s*(CH|CN)\s*/i, "").trim() === "";
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function inches(cm: number): string {
  return String(Math.round(cm / 2.54));
}

function feetInches(cm: number): string {
  const total = Math.round(cm / 2.54);
  return Math.floor(total / 12) + "′" + (total % 12) + "″";
}

function mainSize(tag: TagSize): string | null {
  const printed = (tag.size_printed || "").trim();
  if (printed && !isBodyCode(printed)) return withSystem(printed, tag.size_system);
  // Older answers without size_printed: what is printed besides a body code.
  const decoded = (tag.size_decoded || "").trim();
  if (decoded && !isBodyCode(decoded)) return decoded;
  const rest = (tag.size_raw || "")
    .replace(BODY_CODE, "")
    .replace(/\b(CH|CN)\b/gi, "")
    .replace(/^[\s/|·,-]+|[\s/|·,-]+$/g, "")
    .trim();
  return rest || null;
}

function alsoSizes(tag: TagSize, main: string | null): string | null {
  const seen = new Set<string>(main ? [main.toUpperCase()] : []);
  const out: string[] = [];
  for (const e of tag.size_equivalents || []) {
    const text = typeof e === "string" ? e.trim() : withSystem(String(e?.value ?? ""), e?.system);
    if (!text || isBodyCode(text) || seen.has(text.toUpperCase())) continue;
    seen.add(text.toUpperCase());
    out.push(text);
  }
  return out.length > 0 ? out.join(" · ") : null;
}

// Same lists and ranges as the database (20261125120000_item_sizes.sql), so a
// value the server would refuse is dropped before saving.
export const SIZE_SYSTEMS = ["letter", "EU", "US", "UK", "IT", "FR", "MX", "JP", "waist_length", "kids", "shoe", "other"];
export const FIT_RANGES = {
  height_cm: [50, 230],
  chest_cm: [40, 200],
  waist_cm: [30, 200],
  hip_cm: [40, 220],
} as const;

export type FitCm = { height_cm: number | null; chest_cm: number | null; waist_cm: number | null; hip_cm: number | null };

function inRange(v: number | null, key: keyof typeof FIT_RANGES): number | null {
  if (v === null) return null;
  const [min, max] = FIT_RANGES[key];
  return v >= min && v <= max ? Math.round(v * 10) / 10 : null;
}

// The body a tag's size is made for, in cm: body_fit first, else the body
// code itself. Values outside the database ranges are dropped.
export function fitFromTag(tag: TagSize, category: string | null | undefined): FitCm {
  const none: FitCm = { height_cm: null, chest_cm: null, waist_cm: null, hip_cm: null };
  if (category === "Footwear" || category === "Accessory") return none;
  let height = num(tag.body_fit?.height_cm);
  let chest = num(tag.body_fit?.chest_cm);
  let waist = num(tag.body_fit?.waist_cm);
  if (!height && !chest && !waist) {
    // body_fit missing: read the body code itself.
    const m = (tag.size_raw || "").match(BODY_CODE) || (tag.size_decoded || "").match(BODY_CODE);
    if (!m) return none;
    height = parseInt(m[1], 10);
    // Trousers, skirts and shorts carry the waist; everything else the chest/bust.
    if (category === "Bottom") waist = parseInt(m[2], 10);
    else chest = parseInt(m[2], 10);
  }
  return {
    height_cm: inRange(height, "height_cm"),
    chest_cm: inRange(chest, "chest_cm"),
    waist_cm: inRange(waist, "waist_cm"),
    hip_cm: null,
  };
}

function fitText(fit: FitCm, units: SizeUnits): string | null {
  const imperial = units === "imperial";
  const len = (cm: number) => (imperial ? inches(cm) + " in" : Math.round(cm) + " cm");
  const parts: string[] = [];
  if (fit.height_cm) parts.push("height " + (imperial ? feetInches(fit.height_cm) : Math.round(fit.height_cm) + " cm"));
  if (fit.chest_cm) parts.push("chest/bust " + len(fit.chest_cm));
  if (fit.waist_cm) parts.push("waist " + len(fit.waist_cm));
  if (fit.hip_cm) parts.push("hips " + len(fit.hip_cm));
  return parts.length > 0 ? parts.join(" · ") : null;
}

function fitsText(tag: TagSize, category: string | null | undefined, units: SizeUnits): string | null {
  return fitText(fitFromTag(tag, category), units);
}

// What a tag scan saves on the item: the printed size, its system, the other
// printed sizes, the label text it came from, the raw body code and the body
// in cm. Everything is trimmed to what the server accepts.
export function sizeFieldsFromTag(tag: TagSize | null | undefined, category: string | null | undefined) {
  if (!tag) return {};
  const printedRaw = (tag.size_printed || "").trim();
  const printed = printedRaw && !isBodyCode(printedRaw) ? printedRaw.slice(0, 20) : null;
  const system = printed && SIZE_SYSTEMS.includes(tag.size_system || "") ? (tag.size_system as string) : printed ? "other" : null;
  const equivalents = (tag.size_equivalents || [])
    .map((e) =>
      typeof e === "string"
        ? { system: "other", value: e.trim().slice(0, 20) }
        : {
            system: SIZE_SYSTEMS.includes(e?.system || "") ? (e?.system as string) : "other",
            value: String(e?.value ?? "").trim().slice(0, 20),
          }
    )
    .filter((e) => e.value && !isBodyCode(e.value))
    .slice(0, 10);
  const codeMatch = (tag.size_raw || "").match(BODY_CODE);
  const fit = fitFromTag(tag, category);
  const hasFit = fit.height_cm !== null || fit.chest_cm !== null || fit.waist_cm !== null;
  const evidence = (tag.size_evidence || "").trim().slice(0, 200) || null;
  return {
    size: printed,
    size_system: system,
    size_equivalents: equivalents.length > 0 ? equivalents : null,
    size_evidence: printed || equivalents.length > 0 ? evidence : null,
    size_source: printed || equivalents.length > 0 || codeMatch ? ("label" as const) : null,
    body_code_raw: codeMatch ? codeMatch[0].trim().slice(0, 40) : null,
    fit_height_cm: fit.height_cm,
    fit_chest_cm: fit.chest_cm,
    fit_waist_cm: fit.waist_cm,
    fit_hip_cm: null,
    fit_source: hasFit ? ("label" as const) : null,
  };
}

// The same three lines for a saved item.
export function describeItemSize(
  item: {
    size?: string | null;
    size_system?: string | null;
    size_equivalents?: { system: string; value: string }[] | null;
    fit_height_cm?: number | null;
    fit_chest_cm?: number | null;
    fit_waist_cm?: number | null;
    fit_hip_cm?: number | null;
  },
  units: SizeUnits
): SizeInfo {
  const printed = (item.size || "").trim();
  const main = printed ? withSystem(printed, item.size_system) : null;
  const also = alsoSizes({ size_equivalents: item.size_equivalents || [] }, main);
  const fits = fitText(
    {
      height_cm: item.fit_height_cm ?? null,
      chest_cm: item.fit_chest_cm ?? null,
      waist_cm: item.fit_waist_cm ?? null,
      hip_cm: item.fit_hip_cm ?? null,
    },
    units
  );
  return { main, also, fits };
}

export function describeSize(
  tag: TagSize | null | undefined,
  category: string | null | undefined,
  units: SizeUnits
): SizeInfo {
  if (!tag) return { main: null, also: null, fits: null };
  const main = mainSize(tag);
  return { main, also: alsoSizes(tag, main), fits: fitsText(tag, category, units) };
}
