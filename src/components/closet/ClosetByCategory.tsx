import { useMemo } from "react";
import type { ClosetItem } from "../../types";
import { groupByBucket } from "../../lib/closetBuckets";
import { BucketSection } from "./BucketSection";

// The "By category" closet view: one section per non-empty bucket, in the
// order of CLOSET_BUCKETS, so Needs review (when not empty) is always first.
// All sections are open; empty buckets are hidden.
export function ClosetByCategory({
  items,
  onSelect,
}: {
  items: ClosetItem[];
  onSelect: (item: ClosetItem) => void;
}) {
  const groups = useMemo(() => groupByBucket(items), [items]);
  return (
    <div className="space-y-6">
      {groups.map((g) => (
        <BucketSection key={g.bucket} bucket={g.bucket} items={g.items} onSelect={onSelect} />
      ))}
    </div>
  );
}
