import type { ClosetItem } from "../../types";
import type { ClosetBucket } from "../../lib/closetBuckets";
import { ItemTile } from "./ItemTile";

// One bucket in the "By category" view: a header with the bucket name and
// count, e.g. "Jackets (7)", then the items in the same grid as the closet.
// Header styling matches the open-folder header in ClosetGrid.
export function BucketSection({
  bucket,
  items,
  onSelect,
}: {
  bucket: ClosetBucket;
  items: ClosetItem[];
  onSelect: (item: ClosetItem) => void;
}) {
  return (
    <section className="space-y-3">
      <h3 className="serif text-lg" style={{ color: "var(--emerald)" }}>
        {bucket}{" "}
        <span className="text-xs" style={{ color: "var(--mid-grey)" }}>
          ({items.length})
        </span>
      </h3>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <ItemTile key={item.id} item={item} onSelect={onSelect} />
        ))}
      </div>
    </section>
  );
}
