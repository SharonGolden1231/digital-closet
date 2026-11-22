import { useEffect, useState } from "react";
import type { ClosetItem } from "../../types";
import type { ClosetBucket } from "../../lib/closetBuckets";

// One folder tile in the "By category" view (folder-fixes brief G1, G4; folder-view
// brief F7, F8): a cover photo, the folder name and the item count, e.g. "Jackets · 7".
//
// The cover is ALWAYS the generic category photo bundled with the app:
// /folder-covers/<women|men>/<file>.jpg (never loaded from another site).
// A user's item photo never becomes a cover, so the folder grid loads no
// private item images. If the file is missing or fails to load: a plain tile
// with a neutral background (no image, no emoji).

export type CoverSet = "women" | "men";

// F8: menswear -> men; womenswear, both, or no answer -> women.
// Pass the intro answer the app already loaded (prof.profile.shops_for).
export function coverSetFor(shopsFor: string | null | undefined): CoverSet {
  return shopsFor === "menswear" ? "men" : "women";
}

// Generic cover file per bucket. Needs review is not listed: it has one shared
// cover for both sets, /folder-covers/needs-review.jpg (folder-fixes brief G3).
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
  if (bucket === "Needs review") return "/folder-covers/needs-review.jpg";
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
  const coverSrc = genericCoverUrl(bucket, coverSet);

  // Reset when the cover changes (the shops_for answer switched the set).
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [coverSrc]);
  const src = coverSrc && !failed ? coverSrc : null;

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
          onError={() => setFailed(true)}
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
