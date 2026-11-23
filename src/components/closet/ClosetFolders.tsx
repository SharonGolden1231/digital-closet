import { useEffect, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { ClosetItem } from "../../types";
import { CLOSET_BUCKETS, groupByBucket } from "../../lib/closetBuckets";
import type { ClosetBucket } from "../../lib/closetBuckets";
import { FolderTile, coverSetFor } from "./FolderTile";
import { ItemTile } from "./ItemTile";

// The "By category" closet view as folders (folder-view brief F1, F4, F5, F9, Q3, Q4).
//
// Folder grid: one FolderTile per folder, in CLOSET_BUCKETS order, no items.
// - Every category folder shows, even with 0 items (F5).
// - Needs review shows only when it has items, and then it is first (F5).
// - For menswear users, Dresses & Jumpsuits is hidden while it has 0 items (F9).
//
// Open folder: back arrow + "Jackets · 7" header + that folder's items in the
// closet grid (ItemTile). Tapping an item calls onSelect, same as today (Q3).
// The open folder is local state, so leaving the closet tab and coming back
// shows the folder grid again (Q4).
export function ClosetFolders({
  items,
  shopsFor,
  onSelect,
}: {
  items: ClosetItem[];
  shopsFor: string | null | undefined;
  onSelect: (item: ClosetItem) => void;
}) {
  const [openBucket, setOpenBucket] = useState<ClosetBucket | null>(null);
  const coverSet = coverSetFor(shopsFor);

  const folders = useMemo(() => {
    const byBucket = new Map(groupByBucket(items).map((g) => [g.bucket, g.items]));
    return CLOSET_BUCKETS.map((bucket) => ({ bucket, items: byBucket.get(bucket) || [] })).filter((f) => {
      if (f.items.length > 0) return true;
      if (f.bucket === "Needs review") return false;
      if (f.bucket === "Dresses & Jumpsuits" && shopsFor === "menswear") return false;
      return true;
    });
  }, [items, shopsFor]);

  const openFolder = openBucket ? folders.find((f) => f.bucket === openBucket) || null : null;

  // If the open folder stops being shown (e.g. the last Needs review item was
  // removed), go back to the folder grid.
  useEffect(() => {
    if (openBucket && !openFolder) setOpenBucket(null);
  }, [openBucket, openFolder]);

  // Start each screen (grid or folder) at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [openBucket]);

  if (openFolder) {
    return (
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOpenBucket(null)}
            aria-label="Back to folders"
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "var(--faint)" }}
          >
            <ChevronLeft size={18} color="var(--ink)" />
          </button>
          <h3 className="serif text-lg" style={{ color: "var(--emerald)" }}>
            {openFolder.bucket}{" "}
            <span className="text-xs" style={{ color: "var(--mid-grey)" }}>
              · {openFolder.items.length}
            </span>
          </h3>
        </div>
        {openFolder.items.length > 0 ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {openFolder.items.map((item) => (
              <ItemTile key={item.id} item={item} onSelect={onSelect} />
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-12" style={{ color: "var(--mid-grey)" }}>
            Nothing in this folder yet.
          </p>
        )}
      </section>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {folders.map((f) => (
        <FolderTile key={f.bucket} bucket={f.bucket} items={f.items} coverSet={coverSet} onOpen={setOpenBucket} />
      ))}
    </div>
  );
}
