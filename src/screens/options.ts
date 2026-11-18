// Answer options for the intro questions. The ids must match the values the
// server (api/profile.ts) and the database (style_profiles checks) accept.

export type Option = { id: string; label: string };

export const AGE_BANDS: Option[] = ["18-24", "25-34", "35-44", "45-54", "55-64", "65+"].map((a) => ({
  id: a,
  label: a,
}));

export const SHOPS_FOR: Option[] = [
  { id: "womenswear", label: "Womenswear" },
  { id: "menswear", label: "Menswear" },
  { id: "both", label: "Both" },
];

export const WEEKDAYS: Option[] = [
  { id: "office_formal", label: "Office — formal" },
  { id: "business_casual", label: "Business casual" },
  { id: "creative", label: "Creative workplace" },
  { id: "remote", label: "Work from home" },
  { id: "on_feet", label: "On my feet / uniform" },
  { id: "student", label: "Student" },
  { id: "home_with_kids", label: "At home with kids" },
  { id: "other", label: "Something else" },
  { id: "evenings_out", label: "Dinners / evenings out" },
  { id: "gym_workout", label: "Gym / workout" },
];

export const WEEKENDS: Option[] = [
  { id: "errands", label: "Casual errands" },
  { id: "outdoors_sport", label: "Outdoors / sport" },
  { id: "going_out", label: "Going out" },
  { id: "events", label: "Events" },
  { id: "family", label: "Family time" },
];

export const STYLES: Option[] = [
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "relaxed", label: "Relaxed" },
  { id: "polished", label: "Polished" },
  { id: "edgy", label: "Edgy" },
  { id: "romantic", label: "Romantic" },
  { id: "sporty", label: "Sporty" },
  { id: "bold", label: "Bold" },
  { id: "street_casual", label: "Street casual" },
  { id: "modest", label: "Modest / conservative" },
  { id: "luxe", label: "Luxurious" },
  { id: "quiet_luxury", label: "Quiet luxury" },
  { id: "boho", label: "Boho" },
  { id: "preppy", label: "Preppy" },
  { id: "trendy", label: "Trendy" },
  { id: "vintage", label: "Vintage" },
];

export const GOALS: Option[] = [
  { id: "dress_faster", label: "Get dressed faster" },
  { id: "wear_more_closet", label: "Wear more of my closet" },
  { id: "put_together", label: "Look more put together" },
  { id: "buy_smarter", label: "Buy less, buy smarter" },
  { id: "find_style", label: "Find my style" },
  { id: "new_stage", label: "Dress for a new role or stage" },
  { id: "dress_to_impress", label: "Dress to impress" },
  { id: "new_style", label: "Find a new style" },
  { id: "body_shape", label: "Dress for my body shape" },
];

export const BRAND_TIERS: Option[] = [
  { id: "fast_fashion", label: "High street (Zara, H&M…)" },
  { id: "mid_market", label: "Mid-range (COS, J.Crew…)" },
  { id: "premium", label: "Premium (Theory, Reformation…)" },
  { id: "luxury", label: "Luxury (Gucci, Prada…)" },
  { id: "resale_vintage", label: "Resale & vintage" },
];

export const COMMON_BRANDS = [
  "Zara", "H&M", "Mango", "Uniqlo", "Gap", "Old Navy", "Levi's", "Nike", "Lululemon",
  "Abercrombie & Fitch", "COS", "& Other Stories", "Massimo Dutti", "J.Crew", "Banana Republic",
  "Madewell", "Aritzia", "Free People", "Anthropologie", "Reformation", "Theory", "Ralph Lauren",
  "Calvin Klein", "Tommy Hilfiger", "Coach", "Michael Kors", "Gucci", "Prada", "Louis Vuitton", "Chanel",
];

export const FIT_ISSUES: Option[] = [
  { id: "waist", label: "Waist" },
  { id: "hips", label: "Hips" },
  { id: "chest", label: "Chest" },
  { id: "shoulders", label: "Shoulders" },
  { id: "length", label: "Length" },
  { id: "sleeves", label: "Sleeves" },
  { id: "none", label: "Nothing in particular" },
];

// Same colour names as the closet (and api/_lib/closet.ts COLOR_HEX).
export const COLOR_SWATCHES: Record<string, string> = {
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

export function labelOf(list: Option[], id: string): string {
  return list.find((o) => o.id === id)?.label ?? id;
}

export function cmToFeetInches(cm: number): { ft: number; inch: number } {
  const total = Math.round(cm / 2.54);
  return { ft: Math.floor(total / 12), inch: total % 12 };
}

export function feetInchesToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * 2.54);
}
