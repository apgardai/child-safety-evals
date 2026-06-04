"use client";

import {
  SCORE_VIEW_OPTIONS,
  type ScoreViewMode,
} from "lib/benchmarkScoreViews";

export function ScoreViewToggle({
  mode,
  onChange,
  hasChildScores,
  layout = "cards",
}: {
  mode: ScoreViewMode;
  onChange: (mode: ScoreViewMode) => void;
  hasChildScores: boolean;
  /** `cards` uses larger toggle buttons; `compact` is denser (e.g. risk breakdown header). */
  layout?: "cards" | "compact";
}) {
  const options = hasChildScores
    ? SCORE_VIEW_OPTIONS
    : SCORE_VIEW_OPTIONS.filter((o) => o.value !== "child");

  return (
    <div
      className="inline-flex flex-wrap gap-2"
      role="group"
      aria-label="Score view"
    >
      {options.map(({ value, label, shortLabel }) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={label}
            className={[
              "rounded-lg border transition-colors",
              layout === "cards"
                ? "px-4 py-2.5 text-sm font-medium"
                : "px-3 py-1.5 text-xs font-medium",
              active
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--text)] ring-1 ring-[var(--accent)]/40"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:border-[var(--accent)]/30 hover:text-[var(--text)]",
            ].join(" ")}
            onClick={() => onChange(value)}
          >
            {shortLabel}
          </button>
        );
      })}
    </div>
  );
}
