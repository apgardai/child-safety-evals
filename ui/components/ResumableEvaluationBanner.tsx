"use client";

import Link from "next/link";
import type { EvaluationRunSnapshot } from "hooks/useActiveEvaluationRun";

export function ResumableEvaluationBanner({
  run,
  onDismiss,
}: {
  run: EvaluationRunSnapshot;
  onDismiss?: () => void;
}) {
  const completed = run.scenarios_completed ?? 0;
  const total = run.scenarios_total ?? 0;

  return (
    <div className="mt-8 rounded-xl border border-amber-500/40 bg-amber-950/30 px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-amber-100">
            Cancelled evaluation with partial progress
          </p>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {run.target_model && (
              <>
                Target <span className="text-white">{run.target_model}</span>
                {" · "}
              </>
            )}
            {total > 0 ? (
              <>
                {completed} / {total} scenarios completed. Resume from checkpoint
                is not available yet — view the run or start a new evaluation.
              </>
            ) : (
              <>View the run or start a new evaluation.</>
            )}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link
            href={`/benchmark/runs/${encodeURIComponent(run.id)}`}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            View run
          </Link>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:text-white hover:bg-[var(--border)]/60"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
