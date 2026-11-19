// Groups closet items into the "By category" buckets (trial brief, D1–D7).
// Pure functions, no React. Matching ignores letter case and extra spaces (D6).
//
// category     | sub-category                                   | bucket
// -------------|------------------------------------------------|---------------------
// (blank)      | any                                            | Needs review
// not below    | any                                            | Needs review
// Top          | any                                            | Tops
// Bottom       | any                                            | Bottoms
// Dress        | any                                            | Dresses & Jumpsuits
// Jumpsuit     | any                                            | Dresses & Jumpsuits
// Outerwear    | contains "coat", "puffer" or "parka"           | Coats   (Trench Coat, Puffer)
// Outerwear    | else contains "jacket", "blazer" or "bomber"   | Jackets (Bomber, Blazer, Denim/Leather Jacket)
// Outerwear    | anything else (Gilet, Vest, Cape, blank, ...)  | Needs review
// Activewear   | any                                            | Activewear
// Swimwear     | any                                            | Swimwear
// Sleepwear    | any                                            | Sleepwear
// Footwear     | any                                            | Footwear
// Accessory    | any                                            | Accessories
//
// D7 (Sharon, Nov 19 2026): when a sub-category has both a coat word and a
// jacket word (e.g. "Puffer Jacket"), the coat word wins, so Coats is checked first.

export const CLOSET_BUCKETS = [
  "Needs review",
  "Tops",
  "Bottoms",
  "Dresses & Jumpsuits",
  "Jackets",
  "Coats",
  "Activewear",
  "Swimwear",
  "Sleepwear",
  "Footwear",
  "Accessories",
] as const;

export type ClosetBucket = (typeof CLOSET_BUCKETS)[number];

export interface BucketInput {
  category?: string | null;
  sub_category?: string | null;
}

export interface BucketGroup<T> {
  bucket: ClosetBucket;
  items: T[];
}

const CATEGORY_TO_BUCKET: Record<string, ClosetBucket> = {
  top: "Tops",
  bottom: "Bottoms",
  dress: "Dresses & Jumpsuits",
  jumpsuit: "Dresses & Jumpsuits",
  activewear: "Activewear",
  swimwear: "Swimwear",
  sleepwear: "Sleepwear",
  footwear: "Footwear",
  accessory: "Accessories",
};

const COAT_WORDS = ["coat", "puffer", "parka"];
const JACKET_WORDS = ["jacket", "blazer", "bomber"];

function normalize(value: string | null | undefined): string {
  return (value || "").trim().replace(/\s+/g, " ").toLowerCase();
}

function outerwearBucket(subCategory: string): ClosetBucket {
  if (COAT_WORDS.some((w) => subCategory.includes(w))) return "Coats";
  if (JACKET_WORDS.some((w) => subCategory.includes(w))) return "Jackets";
  return "Needs review";
}

export function bucketFor(item: BucketInput): ClosetBucket {
  const category = normalize(item.category);
  if (category === "outerwear") return outerwearBucket(normalize(item.sub_category));
  return CATEGORY_TO_BUCKET[category] || "Needs review";
}

// Non-empty buckets in CLOSET_BUCKETS order; items keep their original order.
export function groupByBucket<T extends BucketInput>(items: T[]): BucketGroup<T>[] {
  const byBucket = new Map<ClosetBucket, T[]>();
  for (const item of items) {
    const bucket = bucketFor(item);
    const list = byBucket.get(bucket);
    if (list) list.push(item);
    else byBucket.set(bucket, [item]);
  }
  return CLOSET_BUCKETS.filter((b) => byBucket.has(b)).map((b) => ({
    bucket: b,
    items: byBucket.get(b) as T[],
  }));
}
