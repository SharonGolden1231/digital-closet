// Groups closet items into the "By category" buckets (trial brief, D1–D7;
// taxonomy-v2 brief, H2–H5). Pure functions, no React. Matching ignores letter
// case and extra spaces (D6). The first three rows are checked first, in order,
// except that for Outerwear the hoodie row comes after the coat and jacket words.
//
// category             | sub-category                                      | bucket
// ---------------------|---------------------------------------------------|---------------------
// Top or Outerwear     | contains "sweater", "jumper", "cardigan",         | Knitwear & Cardigans
//                      |   "pullover", "knit vest" or "sweater vest"       |   (Sweater Coat too)
// Top or Outerwear*    | contains "sweatshirt", "hoodie" or "hooded"       | Sweatshirts & Joggers
//                      |   (*Outerwear: only with no coat or jacket word)  |
// Bottom or Activewear | contains "jogger" or "sweatpant"                  | Sweatshirts & Joggers
// (blank)              | any                                               | Needs review
// not below            | any                                               | Needs review
// Top                  | any other                                         | Tops
// Bottom               | any other                                         | Bottoms
// Dress                | any                                               | Dresses & Jumpsuits
// Jumpsuit             | any                                               | Dresses & Jumpsuits
// Outerwear            | else contains "coat", "puffer" or "parka"         | Coats   (Trench Coat, Puffer)
// Outerwear            | else contains "jacket", "blazer" or "bomber"      | Jackets (Bomber, Blazer, Denim/Leather Jacket)
// Outerwear            | anything else (Gilet, Vest, Cape, blank, ...)     | Needs review
// Activewear           | any other                                         | Activewear
// Swimwear             | any                                               | Swimwear
// Sleepwear            | any                                               | Sleepwear
// Footwear             | any                                               | Footwear
// Accessory            | any                                               | Accessories
//
// D7 (Sharon, Nov 19 2026): when a sub-category has both a coat word and a
// jacket word (e.g. "Puffer Jacket"), the coat word wins, so Coats is checked first.
// Sharon, Nov 22 2026: the knitwear rule runs before the coat and jacket words,
// so "Sweater Coat" -> Knitwear & Cardigans. Coat and jacket words run before the
// hoodie words, so "Hooded Puffer" -> Coats, "Hooded Jacket" -> Jackets, and an
// Outerwear "Zip Hoodie" -> Sweatshirts & Joggers.

export const CLOSET_BUCKETS = [
  "Needs review",
  "Tops",
  "Knitwear & Cardigans",
  "Sweatshirts & Joggers",
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

const KNIT_WORDS = ["sweater", "jumper", "cardigan", "pullover", "knit vest", "sweater vest"];
const SWEATSHIRT_WORDS = ["sweatshirt", "hoodie", "hooded"];
const JOGGER_WORDS = ["jogger", "sweatpant"];

const has = (text: string, words: string[]) => words.some((w) => text.includes(w));

export function bucketFor(item: BucketInput): ClosetBucket {
  const category = normalize(item.category);
  const sub = normalize(item.sub_category);
  const topOrOuter = category === "top" || category === "outerwear";
  if (topOrOuter && has(sub, KNIT_WORDS)) return "Knitwear & Cardigans";
  if (category === "top" && has(sub, SWEATSHIRT_WORDS)) return "Sweatshirts & Joggers";
  if ((category === "bottom" || category === "activewear") && has(sub, JOGGER_WORDS)) return "Sweatshirts & Joggers";
  if (category === "outerwear") {
    // Coat and jacket words win over hoodie words ("Hooded Puffer" -> Coats).
    const bucket = outerwearBucket(sub);
    if (bucket === "Needs review" && has(sub, SWEATSHIRT_WORDS)) return "Sweatshirts & Joggers";
    return bucket;
  }
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
