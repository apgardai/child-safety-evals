export function ScoreBar({
  score,
  emptyLabel = "—",
}: {
  score: number | null;
  /** Shown when there is no score yet (e.g. home placeholder uses \"XX%\"). */
  emptyLabel?: string;
}) {
  const pct = typeof score === "number" ? Math.round(score) : null;
  const width = pct != null ? Math.min(100, Math.max(0, pct)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex justify-end text-xs">
        <span className="shrink-0 font-semibold tabular-nums text-[var(--text)]">
          {pct != null ? `${pct}%` : emptyLabel}
        </span>
      </div>
      <div
        className="h-2.5 min-w-0 overflow-hidden rounded-full bg-[var(--gray-100)]"
        role="progressbar"
        aria-valuenow={pct ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={pct != null ? `${pct} percent` : "No benchmark runs yet"}
      >
        <div
          className={[
            "h-full rounded-full transition-[width] duration-300",
            pct != null
              ? "bg-gradient-to-r from-[var(--error)] via-[var(--warning)] to-[var(--success)]"
              : "bg-transparent",
          ].join(" ")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
