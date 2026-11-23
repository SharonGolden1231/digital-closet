import { useState } from "react";
import { X } from "lucide-react";
import type { ClosetItem } from "../../types";

export type TypeOption = { category: string; subCategories: string[] };

const same = (a: string | null | undefined, b: string | null | undefined) =>
  (a || "").trim().toLowerCase() === (b || "").trim().toLowerCase();

// "Change type" picker (reclassify brief R2): the same category + type list as
// Add -> Manual, with the item's current values preselected. Cancel changes
// nothing. onSave throws with a readable message when the change fails.
export function ChangeTypeSheet({
  item,
  options,
  icons,
  onSave,
  onCancel,
}: {
  item: ClosetItem;
  options: TypeOption[];
  icons: Record<string, string>;
  onSave: (category: string, subCategory: string) => Promise<void>;
  onCancel: () => void;
}) {
  const startCat = options.find((o) => same(o.category, item.category)) || null;
  const startSub = startCat?.subCategories.find((s) => same(s, item.sub_category)) || "";
  const [cat, setCat] = useState<TypeOption | null>(startCat);
  const [sub, setSub] = useState(startSub);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const unchanged = cat !== null && same(cat.category, item.category) && same(sub, item.sub_category);
  const canSave = cat !== null && sub !== "" && !unchanged && !saving;

  const save = async () => {
    if (!cat || !canSave) return;
    setSaving(true);
    setError("");
    try {
      await onSave(cat.category, sub);
    } catch (err: any) {
      setError(String(err?.message || "Couldn't change the type. Please try again."));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-end sm:items-center justify-center"
      style={{ zIndex: 60 }}
      onClick={saving ? undefined : onCancel}
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.35)" }} />
      <div
        className="relative w-full sm:w-96 overflow-y-auto p-5 rounded-t-2xl sm:rounded-2xl shadow-xl fade-up"
        style={{ background: "var(--parchment)", border: "1px solid var(--warm-grey)", maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onCancel}
          disabled={saving}
          aria-label="Close"
          className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center"
          style={{ background: "var(--faint)" }}
        >
          <X size={14} color="var(--mid-grey)" />
        </button>
        <h3 className="serif text-lg mb-1" style={{ color: "var(--emerald)" }}>
          Change type
        </h3>
        <p className="text-xs mb-4" style={{ color: "var(--mid-grey)" }}>
          Now: {item.category || "—"}
          {item.sub_category ? " · " + item.sub_category : ""}
        </p>

        <p className="text-xs uppercase tracking-widest font-medium mb-2" style={{ color: "var(--mid-grey)" }}>
          Category
        </p>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {options.map((o) => {
            const active = cat?.category === o.category;
            return (
              <button
                key={o.category}
                onClick={() => {
                  if (active) return;
                  setCat(o);
                  setSub("");
                }}
                disabled={saving}
                className="flex items-center gap-2 p-2.5 rounded-xl text-left transition-all"
                style={{
                  background: active ? "var(--emerald)" : "white",
                  border: "1px solid " + (active ? "var(--emerald)" : "var(--warm-grey)"),
                  color: active ? "white" : "var(--ink)",
                }}
              >
                <span className="text-lg">{icons[o.category] || "👗"}</span>
                <span className="text-sm font-medium">{o.category}</span>
              </button>
            );
          })}
        </div>

        {cat && (
          <>
            <p className="text-xs uppercase tracking-widest font-medium mb-2" style={{ color: "var(--mid-grey)" }}>
              {cat.category} — Type
            </p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {cat.subCategories.map((s) => {
                const active = sub === s;
                return (
                  <button
                    key={s}
                    onClick={() => setSub(s)}
                    disabled={saving}
                    className="p-2.5 rounded-xl text-sm text-left transition-all"
                    style={{
                      background: active ? "var(--emerald)" : "white",
                      border: "1px solid " + (active ? "var(--emerald)" : "var(--warm-grey)"),
                      color: active ? "white" : "var(--ink)",
                    }}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </>
        )}

        {error && (
          <p className="text-xs mb-3" style={{ color: "#B91C1C" }}>
            {error}
          </p>
        )}

        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 text-sm py-2.5 rounded-xl"
            style={{ border: "1px solid var(--warm-grey)", color: "var(--mid-grey)" }}
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!canSave}
            className="flex-1 text-sm py-2.5 rounded-xl"
            style={{
              background: "var(--emerald)",
              color: "white",
              opacity: canSave ? 1 : 0.4,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
