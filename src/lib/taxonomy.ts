// How items are grouped in the closet and which icon they show when they have
// no photo. Everything here is derived from the item's category, sub-category
// and name at display time, so changing a rule never needs a database change.

// Set to true to show jackets and coats together in one bucket.
const MERGE_JACKETS_AND_COATS = false;

export const BUCKETS = [
  "Jackets",
  "Coats",
  "Tops",
  "Knitwear",
  "Bottoms",
  "Dresses & Jumpsuits",
  "Footwear",
  "Bags",
  "Accessories",
  "Activewear",
  "Swimwear",
  "Sleepwear",
  "Other",
] as const;

export type Bucket = (typeof BUCKETS)[number];

// The first rule that matches wins, so specific rules come before general ones.
const BUCKET_RULES: [Bucket, RegExp][] = [
  ["Swimwear", /swim|bikini|bathing/],
  ["Sleepwear", /pajama|pyjama|nightgown|nightdress|nightshirt|sleepwear|\brobe\b|loungewear/],
  ["Tops", /dress shirt/],
  [
    "Bottoms",
    /boot.?cut|sweatpant|jogger|legging|dress (pant|trouser)|trouser|\bpants?\b|jeans|skirt|\bshorts\b|chino|culotte|cargo (pant|trouser|short)|slacks|capri|bermuda|palazzo|skort/,
  ],
  [
    "Footwear",
    /sneaker|trainer|boot|heel|sandal|loafer|\bshoes?\b|\bflats?\b|\bpumps?\b|slipper|\bmules?\b|espadrille|oxford|derby|clog|slides?\b|stiletto/,
  ],
  ["Bags", /\bbags?\b|tote|backpack|clutch|purse|satchel|crossbody|handbag|duffel/],
  ["Coats", /coat|parka|puffer|trench|duffle|peacoat|\bcape\b|poncho|\bmac\b/],
  ["Jackets", /jacket|blazer|bomber|windbreaker|gilet|\bvest\b|waistcoat|anorak|biker|shacket|harrington|bolero/],
  ["Dresses & Jumpsuits", /dress|jumpsuit|romper|gown|playsuit|overalls?\b|catsuit/],
  ["Knitwear", /sweater|jumper|cardigan|hoodie|sweatshirt|pullover|\bknit|fleece|turtleneck|crewneck|cashmere/],
  ["Tops", /\btee\b|t-shirt|shirt|blouse|\btops?\b|tank|camisole|\bcami\b|polo|bodysuit|tunic|bustier|corset|henley/],
  [
    "Accessories",
    /scarf|scarves|\bbelt|\bhats?\b|\bcap\b|beanie|glove|sunglass|\bwatch\b|jewel|necklace|bracelet|earring|\brings?\b|\bties?\b|bowtie|wallet|headband|hair|\bsocks?\b|stocking|tights?\b|hosiery/,
  ],
  ["Activewear", /sports bra|yoga|activewear|athletic|workout|running|tracksuit/],
];

const CATEGORY_FALLBACK: Record<string, Bucket> = {
  Top: "Tops",
  Bottom: "Bottoms",
  Outerwear: "Jackets",
  Dress: "Dresses & Jumpsuits",
  Jumpsuit: "Dresses & Jumpsuits",
  Footwear: "Footwear",
  Accessory: "Accessories",
  Activewear: "Activewear",
  Swimwear: "Swimwear",
  Sleepwear: "Sleepwear",
};

function haystack(subCategory: string | null | undefined, name: string | null | undefined): string {
  return ((subCategory || "") + " " + (name || "")).toLowerCase();
}

export function bucketOf(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  name: string | null | undefined
): Bucket {
  const text = haystack(subCategory, name);
  let found: Bucket | null = null;
  for (const rule of BUCKET_RULES) {
    if (rule[1].test(text)) {
      found = rule[0];
      break;
    }
  }
  if (!found) found = CATEGORY_FALLBACK[category || ""] || "Other";
  if (MERGE_JACKETS_AND_COATS && found === "Coats") return "Jackets";
  return found;
}

// The label shown for a bucket (the merged bucket reads "Jackets & Coats").
export function bucketLabel(bucket: Bucket): string {
  return MERGE_JACKETS_AND_COATS && bucket === "Jackets" ? "Jackets & Coats" : bucket;
}

const BUCKET_EMOJI: Record<Bucket, string> = {
  Jackets: "🧥",
  Coats: "🧥",
  Tops: "👕",
  Knitwear: "🧶",
  Bottoms: "👖",
  "Dresses & Jumpsuits": "👗",
  Footwear: "👟",
  Bags: "👜",
  Accessories: "✨",
  Activewear: "🏃",
  Swimwear: "🩱",
  Sleepwear: "🌙",
  Other: "👗",
};

// More specific icons, checked before falling back to the bucket's icon.
const EMOJI_RULES: [RegExp, string][] = [
  [/scarf|scarves/, "🧣"],
  [/sunglass/, "🕶️"],
  [/\bwatch\b/, "⌚"],
  [/\bhats?\b|\bcap\b|beanie/, "🧢"],
  [/glove/, "🧤"],
  [/\bties?\b|bowtie/, "👔"],
  [/\brings?\b/, "💍"],
  [/necklace/, "📿"],
  [/backpack/, "🎒"],
  [/clutch|purse/, "👛"],
  [/boot/, "🥾"],
  [/heel|stiletto|\bpumps?\b/, "👠"],
  [/sandal|slides?\b/, "🩴"],
  [/loafer|oxford|derby|\bflats?\b/, "👞"],
  [/\bshorts\b/, "🩳"],
  [/blouse/, "👚"],
];

export function emojiFor(
  category: string | null | undefined,
  subCategory: string | null | undefined,
  name: string | null | undefined
): string {
  const text = haystack(subCategory, name);
  for (const rule of EMOJI_RULES) {
    if (rule[0].test(text)) return rule[1];
  }
  return BUCKET_EMOJI[bucketOf(category, subCategory, name)];
}

// A stable id for page anchors, e.g. "Dresses & Jumpsuits" -> "bucket-dresses-jumpsuits".
export function bucketAnchor(bucket: Bucket): string {
  return "bucket-" + bucket.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
}
