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

// Builds the stylist's closet summary from the database, for the signed-in
// user only. The browser no longer sends it, so it cannot be forged or
// truncated. Returns "" if the closet is empty or the lookup fails.
export async function loadClosetContext(token: string): Promise<string> {
  const db = userClient(token);
  if (!db) return "";
  const { data, error } = await db
    .from("closet_items")
    .select("name, category, brand, color_names")
    .is("deleted_at", null)
    .eq("user_confirmed", true)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error || !data) {
    console.error("Closet context lookup failed:", error?.message);
    return "";
  }
  let out = "";
  for (const r of data as any[]) {
    const colors = Array.isArray(r.color_names) ? r.color_names.join("/") : "";
    const line = `- ${r.name} (${r.category}, ${colors}, ${r.brand ?? "Unknown"})`;
    if (out.length + line.length + 1 > MAX_CONTEXT_CHARS) break;
    out += (out ? "\n" : "") + line;
  }
  return out;
}
