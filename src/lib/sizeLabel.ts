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

function fitsText(tag: TagSize, category: string | null | undefined, units: SizeUnits): string | null {
  if (category === "Footwear" || category === "Accessory") return null;
  let height = num(tag.body_fit?.height_cm);
  let chest = num(tag.body_fit?.chest_cm);
  let waist = num(tag.body_fit?.waist_cm);
  if (!height && !chest && !waist) {
    // body_fit missing: read the body code itself.
    const m = (tag.size_raw || "").match(BODY_CODE) || (tag.size_decoded || "").match(BODY_CODE);
    if (!m) return null;
    height = parseInt(m[1], 10);
    // Trousers, skirts and shorts carry the waist; everything else the chest/bust.
    if (category === "Bottom") waist = parseInt(m[2], 10);
    else chest = parseInt(m[2], 10);
  }
  const imperial = units === "imperial";
  const len = (cm: number) => (imperial ? inches(cm) + " in" : Math.round(cm) + " cm");
  const parts: string[] = [];
  if (height) parts.push("height " + (imperial ? feetInches(height) : Math.round(height) + " cm"));
  if (chest) parts.push("chest/bust " + len(chest));
  if (waist) parts.push("waist " + len(waist));
  return parts.length > 0 ? parts.join(" · ") : null;
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
