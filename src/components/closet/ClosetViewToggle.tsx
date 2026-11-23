// "By category" | "All items" switch for the closet. Styled like the
// existing Folders | All items pill toggle in ClosetGrid.

export type ClosetView = "category" | "all";

const OPTIONS: [ClosetView, string][] = [
  ["category", "By category"],
  ["all", "All items"],
];

export function ClosetViewToggle({
  value,
  onChange,
}: {
  value: ClosetView;
  onChange: (view: ClosetView) => void;
}) {
  return (
    <div className="inline-flex rounded-full p-0.5" style={{ background: "var(--faint)" }}>
      {OPTIONS.map((opt) => (
        <button
          key={opt[0]}
          onClick={() => onChange(opt[0])}
          aria-pressed={value === opt[0]}
          className="text-xs px-3 py-1.5 rounded-full transition-all"
          style={
            value === opt[0]
              ? { background: "white", color: "var(--emerald)", boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }
              : { color: "var(--mid-grey)" }
          }
        >
          {opt[1]}
        </button>
      ))}
    </div>
  );
}
