// Picks the cover photo for a closet folder (folder-view brief, Q1 and F3).
// Pure functions, no React.
//
// "Has a real photo" uses the same test ItemTile uses to decide between a
// photo and an emoji: the item has an imageUrl. For saved items that is the
// signed thumbnail URL from /api/items; for items added in this session it is
// the local camera preview. Items without one (emoji / incomplete items) are
// skipped, so a cover is never an emoji.

export interface CoverCandidate {
  imageUrl?: string | null;
  addedAt?: string | null;
}

export function hasRealPhoto(item: CoverCandidate): boolean {
  return Boolean(item.imageUrl);
}

function addedTime(item: CoverCandidate): number {
  const t = item.addedAt ? Date.parse(item.addedAt) : NaN;
  return Number.isNaN(t) ? -Infinity : t;
}

// The most recently added item in the folder that has a real photo, or null
// when none has one (the tile then uses the generic category cover, F7).
// Ties keep the earlier item in the list, which is the newer one, because the
// closet list is already newest first.
export function pickCoverItem<T extends CoverCandidate>(items: T[]): T | null {
  let best: T | null = null;
  let bestTime = -Infinity;
  for (const item of items) {
    if (!hasRealPhoto(item)) continue;
    const t = addedTime(item);
    if (best === null || t > bestTime) {
      best = item;
      bestTime = t;
    }
  }
  return best;
}
