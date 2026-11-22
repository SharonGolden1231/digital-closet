import { useEffect, useState } from "react";
import type { ClosetItem } from "../../types";
import type { ClosetBucket } from "../../lib/closetBuckets";
import { pickCoverItem } from "../../lib/folderCover";

// One folder tile in the "By category" view (folder-view brief F2, F3, F7, F8, Q2):
// a cover photo, the folder name and the item count, e.g. "Jackets · 7".
//
// Cover order:
// 1. The newest item in the folder with a real photo, shown exactly the way
//    ItemTile shows it (<img src={item.imageUrl}>, the signed thumbnail).
// 2. Otherwise the generic category photo bundled with the app:
//    /folder-covers/<women|men>/<file>.jpg (never loaded from another site).
// 3. If that file is missing or fails to load: a plain tile with a neutral
//    background (no image, no emoji).

export type CoverSet = "women" | "men";

// F8: menswear -> men; womenswear, both, or no answer -> women.
// Pass the intro answer the app already loaded (prof.profile.shops_for).
export function coverSetFor(shopsFor: string | null | undefined): CoverSet {
  return shopsFor === "menswear" ? "men" : "women";
}

// Generic cover file per bucket. Needs review has none, so it uses the Q2 fallback.
const GENERIC_FILE: Partial<Record<ClosetBucket, string>> = {
  Tops: "tops",
  Bottoms: "bottoms",
  "Dresses & Jumpsuits": "dresses-jumpsuits",
  Jackets: "jackets",
  Coats: "coats",
  Activewear: "activewear",
  Swimwear: "swimwear",
  Sleepwear: "sleepwear",
  Footwear: "footwear",
  Accessories: "accessories",
};

export function genericCoverUrl(bucket: ClosetBucket, set: CoverSet): string | null {
  const file = GENERIC_FILE[bucket];
  return file ? `/folder-covers/${set}/${file}.jpg` : null;
}

const COVER_HEIGHT = 140; // same photo height as ItemTile

export function FolderTile({
  bucket,
  items,
  coverSet,
  onOpen,
}: {
  bucket: ClosetBucket;
  items: ClosetItem[];
  coverSet: CoverSet;
  onOpen: (bucket: ClosetBucket) => void;
}) {
  const coverItem = pickCoverItem(items);
  const itemSrc = coverItem?.imageUrl || null;
  const genericSrc = genericCoverUrl(bucket, coverSet);

  // Sources that failed to load. If the item photo fails, try the generic
  // cover; if that fails too, show the plain tile. Cleared when either source
  // changes (new item, or the shops_for answer switched the generic set).
  const [failed, setFailed] = useState<string[]>([]);
  useEffect(() => setFailed([]), [itemSrc, genericSrc]);
  const src = [itemSrc, genericSrc].find((s): s is string => !!s && !failed.includes(s)) || null;

  return (
    <button
      onClick={() => onOpen(bucket)}
      className="text-left rounded-2xl overflow-hidden transition-all"
      style={{ background: "white", border: "1px solid var(--warm-grey)" }}
    >
      {src ? (
        <img
          src={src}
          alt={bucket}
          className="w-full object-cover"
          style={{ height: COVER_HEIGHT }}
          onError={() => setFailed((f) => [...f, src])}
        />
      ) : (
        <div className="w-full" style={{ height: COVER_HEIGHT, background: "var(--warm-grey)" }} />
      )}
      <div className="p-3">
        <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
          {bucket}{" "}
          <span style={{ color: "var(--mid-grey)" }}>· {items.length}</span>
        </p>
      </div>
    </button>
  );
}
