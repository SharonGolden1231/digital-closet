// Turns what a tag prints about size into words a user understands.
// No conversion tables: a printed letter/EU size is shown as is, and a
// Chinese height/body code (e.g. 165/84A) is shown as the body it fits.

export type SizeUnits = "metric" | "imperial";

// GB/T body codes: height cm / chest-or-waist cm, optional body-shape letter.
const CHINA_CODE = /(\d{3})\s*\/\s*(\d{2,3})\s*[A-Z]?/i;

function isChinaCode(s: string): boolean {
  return CHINA_CODE.test(s) && s.replace(CHINA_CODE, "").replace(/^\s*(CH|CN)\s*/i, "").trim() === "";
}

function inches(cm: number): string {
  return String(Math.round(cm / 2.54));
}

function feetInches(cm: number): string {
  const total = Math.round(cm / 2.54);
  return Math.floor(total / 12) + "′" + (total % 12) + "″";
}

export type SizeInfo = {
  // The size to show, as printed (e.g. "S", "38"); null when only a code is printed.
  main: string | null;
  // The body a Chinese code fits, in the user's units; null when there is no code.
  fits: string | null;
};

export function describeSize(
  sizeRaw: string | null | undefined,
  sizeDecoded: string | null | undefined,
  category: string | null | undefined,
  units: SizeUnits
): SizeInfo {
  const raw = (sizeRaw || "").trim();
  const decoded = (sizeDecoded || "").trim();
  // What is left of the printed size once a body code is taken out ("S / 165/84A" -> "S").
  const rawPrinted = raw
    .replace(CHINA_CODE, "")
    .replace(/\b(CH|CN)\b/gi, "")
    .replace(/^[\s/|·,-]+|[\s/|·,-]+$/g, "")
    .trim();
  const main = decoded && !isChinaCode(decoded) ? decoded : rawPrinted || null;

  const m = (raw.match(CHINA_CODE) || decoded.match(CHINA_CODE)) as RegExpMatchArray | null;
  if (!m || category === "Footwear" || category === "Accessory") return { main, fits: null };

  const height = parseInt(m[1], 10);
  const second = parseInt(m[2], 10);
  // Trousers, skirts and shorts carry the waist; everything else the chest/bust.
  const secondLabel = category === "Bottom" ? "waist" : "chest/bust";
  const fits =
    units === "imperial"
      ? "height " + feetInches(height) + " · " + secondLabel + " " + inches(second) + " in"
      : "height " + height + " cm · " + secondLabel + " " + second + " cm";
  return { main, fits };
}
