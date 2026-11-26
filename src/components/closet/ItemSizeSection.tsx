import { useEffect, useState } from "react";
import type { ClosetItem } from "../../types";
import { describeItemSize, FIT_RANGES, SIZE_SYSTEMS } from "../../lib/sizeLabel";
import type { FitCm, SizeUnits } from "../../lib/sizeLabel";

// Item card: the label size and the body it fits (item-size brief S1, S3).
// Shown always; the person can correct it. Values are stored in cm and
// entered in cm or inches, following the cm/in switch.

const SYSTEM_LABELS: Record<string, string> = {
  letter: "Letter (S, M, L)",
  EU: "EU",
  US: "US",
  UK: "UK",
  IT: "IT",
  FR: "FR",
  MX: "MEX",
  JP: "JP",
  waist_length: "Waist / length (W32 L34)",
  kids: "Kids",
  shoe: "Shoe",
  other: "Other",
};

const FIELDS: { key: keyof FitCm; label: string }[] = [
  { key: "height_cm", label: "Height" },
  { key: "chest_cm", label: "Chest / bust" },
  { key: "waist_cm", label: "Waist" },
  { key: "hip_cm", label: "Hips" },
];

const CM_PER_IN = 2.54;

function toInput(cm: number | null | undefined, units: SizeUnits): string {
  if (cm === null || cm === undefined) return "";
  return units === "imperial" ? String(Math.round((cm / CM_PER_IN) * 10) / 10) : String(cm);
}

function UnitSwitch({ units, onChange }: { units: SizeUnits; onChange: (u: SizeUnits) => void }) {
  return (
    <span className="flex rounded-full overflow-hidden shrink-0" style={{ border: "1px solid var(--warm-grey)" }}>
      {(["metric", "imperial"] as SizeUnits[]).map((u) => (
        <button
          key={u}
          type="button"
          aria-pressed={units === u}
          onClick={() => onChange(u)}
          className="px-2 py-0.5 text-xs"
          style={{
            background: units === u ? "var(--emerald)" : "white",
            color: units === u ? "#F7F4EE" : "var(--mid-grey)",
          }}
        >
          {u === "metric" ? "cm" : "in"}
        </button>
      ))}
    </span>
  );
}

export function ItemSizeSection({
  item,
  units,
  onUnitsChange,
  canEdit,
  onSave,
}: {
  item: ClosetItem;
  units: SizeUnits;
  onUnitsChange: (u: SizeUnits) => void;
  canEdit: boolean;
  onSave: (size: { printed: string | null; system: string | null }, fit: FitCm) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [printed, setPrinted] = useState("");
  const [system, setSystem] = useState("letter");
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // A different item, or the switch, resets the form.
  useEffect(() => {
    setEditing(false);
    setError("");
  }, [item.id]);

  const startEdit = () => {
    setPrinted(item.size || "");
    setSystem(item.size_system && SIZE_SYSTEMS.includes(item.size_system) ? item.size_system : "letter");
    setValues({
      height_cm: toInput(item.fit_height_cm, units),
      chest_cm: toInput(item.fit_chest_cm, units),
      waist_cm: toInput(item.fit_waist_cm, units),
      hip_cm: toInput(item.fit_hip_cm, units),
    });
    setError("");
    setEditing(true);
  };

  // Switching units while editing converts what is typed.
  const changeUnits = (u: SizeUnits) => {
    if (editing && u !== units) {
      const next: Record<string, string> = {};
      for (const f of FIELDS) {
        const n = parseFloat(values[f.key] || "");
        if (!Number.isFinite(n)) next[f.key] = values[f.key] || "";
        else next[f.key] = String(Math.round((u === "imperial" ? n / CM_PER_IN : n * CM_PER_IN) * 10) / 10);
      }
      setValues(next);
    }
    onUnitsChange(u);
  };

  const save = async () => {
    const size = printed.trim();
    if (size.length > 20) {
      setError("The size can be at most 20 characters.");
      return;
    }
    const fit: FitCm = { height_cm: null, chest_cm: null, waist_cm: null, hip_cm: null };
    for (const f of FIELDS) {
      const raw = (values[f.key] || "").trim().replace(",", ".");
      if (!raw) continue;
      const n = parseFloat(raw);
      const cm = units === "imperial" ? n * CM_PER_IN : n;
      const [min, max] = FIT_RANGES[f.key];
      if (!Number.isFinite(n) || cm < min || cm > max) {
        const range =
          units === "imperial"
            ? Math.round(min / CM_PER_IN) + "–" + Math.round(max / CM_PER_IN) + " in"
            : min + "–" + max + " cm";
        setError(f.label + " must be between " + range + ".");
        return;
      }
      fit[f.key] = Math.round(cm * 10) / 10;
    }
    // Nothing changed: close without saving, so it is not marked as a correction.
    const sameSize = size === (item.size || "").trim() && (!size || system === (item.size_system || "letter"));
    const near = (a: number | null, b: number | null | undefined) =>
      a === null ? b === null || b === undefined : b !== null && b !== undefined && Math.abs(a - b) < 0.6;
    const sameFit =
      near(fit.height_cm, item.fit_height_cm) &&
      near(fit.chest_cm, item.fit_chest_cm) &&
      near(fit.waist_cm, item.fit_waist_cm) &&
      near(fit.hip_cm, item.fit_hip_cm);
    if (sameSize && sameFit) {
      setEditing(false);
      setError("");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({ printed: size || null, system: size ? system : null }, fit);
      setEditing(false);
    } catch (e: any) {
      setError(e?.message || "Couldn't save the size. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const info = describeItemSize(item, units);
  const corrected = item.size_source === "user" || item.fit_source === "user";
  const unitLabel = units === "imperial" ? "in" : "cm";

  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--mid-grey)" }}>
          Size
        </span>
        <UnitSwitch units={units} onChange={changeUnits} />
      </div>

      {!editing && (
        <>
          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
            {info.main ? "Size " + info.main : "No size yet"}
          </p>
          {info.also && (
            <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
              Also: {info.also}
            </p>
          )}
          {info.fits && (
            <p className="text-xs" style={{ color: "var(--ink)" }}>
              Fits {info.fits}
            </p>
          )}
          {corrected && (
            <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
              Your correction
            </p>
          )}
          {canEdit ? (
            <button
              type="button"
              onClick={startEdit}
              className="w-full text-sm py-2.5 rounded-xl"
              style={{ background: "white", border: "1px solid var(--warm-grey)", color: "var(--emerald)" }}
            >
              {info.main || info.fits ? "Edit size" : "Add size"}
            </button>
          ) : (
            <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
              You can edit the size once this item is saved.
            </p>
          )}
        </>
      )}

      {editing && (
        <div className="space-y-2 rounded-xl p-3" style={{ background: "white", border: "1px solid var(--warm-grey)" }}>
          <label className="block text-xs" style={{ color: "var(--mid-grey)" }}>
            Size as printed
            <input
              value={printed}
              onChange={(e) => setPrinted(e.target.value.slice(0, 20))}
              placeholder="e.g. S, 38, W32 L34"
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
              style={{ border: "1px solid var(--warm-grey)", color: "var(--ink)" }}
            />
          </label>
          <label className="block text-xs" style={{ color: "var(--mid-grey)" }}>
            Size system
            <select
              value={system}
              onChange={(e) => setSystem(e.target.value)}
              className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
              style={{ border: "1px solid var(--warm-grey)", color: "var(--ink)", background: "white" }}
            >
              {SIZE_SYSTEMS.map((s) => (
                <option key={s} value={s}>
                  {SYSTEM_LABELS[s] || s}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs pt-1" style={{ color: "var(--mid-grey)" }}>
            Fits a body of ({unitLabel}), leave empty if unknown
          </p>
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="block text-xs" style={{ color: "var(--mid-grey)" }}>
                {f.label}
                <input
                  inputMode="decimal"
                  value={values[f.key] || ""}
                  onChange={(e) => setValues({ ...values, [f.key]: e.target.value.replace(/[^\d.,]/g, "").slice(0, 6) })}
                  placeholder={unitLabel}
                  className="mt-1 w-full rounded-lg px-2 py-1.5 text-sm"
                  style={{ border: "1px solid var(--warm-grey)", color: "var(--ink)" }}
                />
              </label>
            ))}
          </div>
          {error && (
            <p className="text-xs" style={{ color: "#B91C1C" }}>
              {error}
            </p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="flex-1 text-xs py-2 rounded-xl"
              style={{ border: "1px solid var(--warm-grey)", color: "var(--mid-grey)" }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="flex-1 text-xs py-2 rounded-xl"
              style={{ background: "var(--emerald)", color: "#F7F4EE" }}
            >
              {saving ? "Saving…" : "Save size"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
