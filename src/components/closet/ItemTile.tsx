import type { ClosetItem } from "../../types";
import { emojiFor } from "../../lib/taxonomy";
import { COLOR_HEX, getBadgeStyle } from "../../lib/itemStyle";

// One closet item card: photo (or emoji on a color wash), name, brand,
// color dots and source badge. Moved unchanged from ClosetGrid in App.tsx.
export function ItemTile({ item, onSelect }: { item: ClosetItem; onSelect: (item: ClosetItem) => void }) {
  const color = item.colors[0] ? COLOR_HEX[item.colors[0]] || "#9CA3AF" : "#9CA3AF";
  const badgeStyle = getBadgeStyle(item.badge);
  return (
    <button
      onClick={() => onSelect(item)}
      className="text-left rounded-2xl overflow-hidden transition-all"
      style={{ background: "white", border: "1px solid var(--warm-grey)" }}
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.name} className="w-full object-cover" style={{ height: 140 }} />
      ) : (
        <div
          className="w-full flex items-center justify-center"
          style={{ height: 140, background: color + "15", fontSize: 48 }}
        >
          {emojiFor(item.category, item.sub_category, item.name)}
        </div>
      )}
      <div className="p-3">
        <p className="text-xs font-medium truncate" style={{ color: "var(--ink)" }}>
          {item.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: "var(--mid-grey)" }}>
          {item.brand}
        </p>
        <div className="flex flex-wrap gap-1 mt-1.5">
          {item.colors.map((c) => (
            <span
              key={c}
              className="w-3 h-3 rounded-full border"
              style={{ background: COLOR_HEX[c] || "#ccc", borderColor: "var(--warm-grey)" }}
              title={c}
            />
          ))}
        </div>
        <span className="text-xs px-1.5 py-0.5 rounded-full mt-1.5 inline-block" style={badgeStyle as any}>
          {item.badge}
        </span>
      </div>
    </button>
  );
}
