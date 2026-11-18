import type { ReactNode } from "react";

// Small shared building blocks for the account and onboarding screens, in the
// app's existing look (parchment background, emerald and gold).

export function Page({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center px-5 py-10" style={{ background: "var(--parchment)" }}>
      <div className="w-full max-w-md space-y-6 fade-up">{children}</div>
    </div>
  );
}

export function Title({ children, sub }: { children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <h1 className="serif text-3xl" style={{ color: "var(--emerald)", lineHeight: 1.15 }}>
        {children}
      </h1>
      {sub && (
        <p className="text-sm" style={{ color: "var(--mid-grey)" }}>
          {sub}
        </p>
      )}
    </div>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs uppercase tracking-widest font-medium" style={{ color: "var(--gold)" }}>
        {children}
      </p>
      {hint && (
        <p className="text-xs" style={{ color: "var(--mid-grey)" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

export function Chip({
  label,
  selected,
  onClick,
  disabled,
  swatch,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
  disabled?: boolean;
  swatch?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled && !selected}
      aria-pressed={selected}
      className="px-3.5 py-2 rounded-full text-sm border transition-all disabled:opacity-35 flex items-center gap-2"
      style={
        selected
          ? { background: "var(--emerald)", borderColor: "var(--emerald)", color: "#F7F4EE" }
          : { background: "white", borderColor: "var(--warm-grey)", color: "var(--ink)" }
      }
    >
      {swatch && (
        <span
          className="w-3.5 h-3.5 rounded-full inline-block"
          style={{ background: swatch, border: "1px solid rgba(0,0,0,0.12)" }}
        />
      )}
      {label}
    </button>
  );
}

export function ChipGroup({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

export function Primary({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-xl text-sm font-medium transition-all disabled:opacity-40"
      style={{ background: "var(--emerald)", color: "#F7F4EE" }}
    >
      {children}
    </button>
  );
}

export function Secondary({ children, onClick, disabled }: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full py-3 rounded-xl text-sm font-medium border transition-all disabled:opacity-40"
      style={{ background: "white", borderColor: "var(--warm-grey)", color: "var(--ink)" }}
    >
      {children}
    </button>
  );
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-xs underline" style={{ color: "var(--mid-grey)" }}>
      {children}
    </button>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="text-xs rounded-xl px-3 py-2"
      style={{ background: "var(--error-bg)", color: "var(--error-ink)" }}
    >
      {children}
    </p>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="bg-white rounded-2xl p-4 space-y-3" style={{ border: "1px solid var(--warm-grey)" }}>
      {children}
    </div>
  );
}

export const inputStyle = {
  background: "white",
  border: "1px solid var(--warm-grey)",
  color: "var(--ink)",
};
