import { createClient } from "@supabase/supabase-js";

export const BUCKET = "closet-private";

// Shown when an item has no photo yet. The database requires an emoji, a
// category and a color for these items, and marks them incomplete.
export const CATEGORY_EMOJI: Record<string, string> = {
  Top: "👕",
  Bottom: "👖",
  Outerwear: "🧥",
  Dress: "👗",
  Jumpsuit: "🦱",
  Footwear: "👟",
  Accessory: "👜",
  Activewear: "🏃",
  Swimwear: "🩱",
  Sleepwear: "🌙",
};

export const COLOR_HEX: Record<string, string> = {
  Black: "#2B2927",
  White: "#F7F4EE",
  Navy: "#1e3a5f",
  Grey: "#9CA3AF",
  Charcoal: "#36454F",
  Beige: "#D4B896",
  Brown: "#8B6914",
  Red: "#B91C1C",
  Pink: "#F4A7B9",
  Orange: "#EA580C",
  Yellow: "#CA8A04",
  Green: "#15803D",
  Blue: "#2563EB",
  Purple: "#7C3AED",
  Cream: "#F5F1EB",
  Olive: "#6B7C3E",
  Burgundy: "#800020",
  Camel: "#C19A6B",
  Tan: "#D2B48C",
};
export const DEFAULT_HEX = "#9CA3AF";

const MAX_CONTEXT_CHARS = 40000;
const MAX_OUTFITS = 3;
const MAX_ITEMS_PER_OUTFIT = 8;

// A Supabase client that acts AS THE SIGNED-IN USER. Row-level security
// applies to everything it does, so a bug in a route cannot reach another
// user's data. Uses the public (publishable) key plus the user's own token.
export function userClient(token: string) {
  const url = process.env.SUPABASE_URL;
  const key =
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key || !token) return null;
  return createClient(url, key, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type Outfit = {
  title: string;
  note: string;
  itemIds: string[];
  missing: string[];
};

// Builds the stylist's closet summary from the database, for the signed-in
// user only. Every item gets a short number (#1, #2, ...) so the stylist can
// point at items without repeating long ids; `ids[n - 1]` is the real item id.
// Returns an empty closet if it is empty or the lookup fails.
export async function loadClosetForChat(
  token: string
): Promise<{ context: string; ids: string[] }> {
  const db = userClient(token);
  if (!db) return { context: "", ids: [] };
  const { data, error } = await db
    .from("closet_items")
    .select("id, name, category, brand, color_names")
    .is("deleted_at", null)
    .eq("user_confirmed", true)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) {
    console.error("Closet context lookup failed:", error?.message);
    return { context: "", ids: [] };
  }
  const ids: string[] = [];
  let out = "";
  for (const r of data as any[]) {
    const colors = Array.isArray(r.color_names) ? r.color_names.join("/") : "";
    const line = `#${ids.length + 1} ${r.name} (${r.category}, ${colors}, ${r.brand ?? "Unknown"})`;
    if (out.length + line.length + 1 > MAX_CONTEXT_CHARS) break;
    out += (out ? "\n" : "") + line;
    ids.push(r.id);
  }
  return { context: out, ids };
}

function cleanText(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// Turns the stylist's outfit suggestions into safe data for the app. Item
// numbers that do not exist in the user's closet are dropped, so the model can
// never show an item the user does not own.
export function normalizeOutfits(raw: unknown, ids: string[]): Outfit[] {
  if (!Array.isArray(raw)) return [];
  const outfits: Outfit[] = [];
  for (const entry of raw.slice(0, 10)) {
    if (outfits.length >= MAX_OUTFITS) break;
    if (!entry || typeof entry !== "object") continue;
    const e = entry as any;
    const seen = new Set<string>();
    const itemIds: string[] = [];
    for (const n of Array.isArray(e.items) ? e.items : []) {
      const index = Number(n);
      if (!Number.isInteger(index) || index < 1 || index > ids.length) continue;
      const id = ids[index - 1];
      if (seen.has(id)) continue;
      seen.add(id);
      itemIds.push(id);
      if (itemIds.length >= MAX_ITEMS_PER_OUTFIT) break;
    }
    const missing = (Array.isArray(e.missing) ? e.missing : [])
      .map((m: unknown) => cleanText(m, 60))
      .filter((m: string) => m.length > 0)
      .slice(0, 4);
    if (itemIds.length === 0 && missing.length === 0) continue;
    outfits.push({
      title: cleanText(e.title, 60) || "Outfit",
      note: cleanText(e.note, 200),
      itemIds,
      missing,
    });
  }
  return outfits;
}
