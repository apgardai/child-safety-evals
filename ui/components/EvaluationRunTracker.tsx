"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { EvaluationRunSnapshot } from "hooks/useActiveEvaluationRun";
import {
  EVALUATION_RUN_STATUS_META,
  type EvaluationRunStatus,
} from "lib/evaluationRunStatus";

function shortId(id: string): string {
  return id.length > 8 ? `${id.slice(0, 8)}…` : id;
}

export function EvaluationRunTracker({
  run,
  pollError,
  loading,
  starting,
  cancelling,
  onRefresh,
  onCancel,
}: {
  run: EvaluationRunSnapshot | null;
  pollError: string | null;
  loading?: boolean;
  starting?: boolean;
  cancelling?: boolean;
  onRefresh?: () => void;
  onCancel?: () => void;
}) {
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [run?.progress_log, run?.status]);

  if (loading && !run) {
    return (
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-sm text-[var(--muted)]">Loading evaluation status…</p>
      </div>
    );
  }

  if (!run && !starting && !pollError) {
    return null;
  }

  const status: EvaluationRunStatus = starting
    ? "pending"
    : run?.status ?? "pending";
  const meta = EVALUATION_RUN_STATUS_META[status];
  const showSpinner =
    (status === "pending" || status === "running" || starting) && !cancelling;
  const showCancel =
    onCancel != null &&
    !starting &&
    (run?.status === "pending" || run?.status === "running");

  const scenariosTotal = run?.scenarios_total ?? null;
  const scenariosCompleted = run?.scenarios_completed ?? 0;
  const showScenarioProgress =
    scenariosTotal != null &&
    scenariosTotal > 0 &&
    (status === "pending" || status === "running" || starting);

  return (
    <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
      <div
        className={`border-b px-4 py-3 ${meta.barClass} border-[var(--border)]`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 min-w-0">
            <span
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${meta.badgeClass}`}
            >
              {showSpinner && (
                <span
                  className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent"
                  aria-hidden
                />
              )}
              {cancelling
                ? "Cancelling…"
                : starting
                  ? "Starting…"
                  : meta.label}
            </span>
            {run?.target_model && (
              <span className="text-sm text-white truncate">
                Target: <span className="font-medium">{run.target_model}</span>
              </span>
            )}
            {run?.id && (
              <span
                className="text-xs text-[var(--muted)] font-mono"
                title={run.id}
              >
                Run {shortId(run.id)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showCancel && (
              <button
                type="button"
                onClick={() => onCancel()}
                disabled={cancelling}
                className="text-xs px-3 py-1 rounded-lg border border-[var(--error)]/50 text-[var(--error)] hover:bg-[var(--error)]/15 disabled:opacity-50"
              >
                Cancel
              </button>
            )}
            {onRefresh && (
              <button
                type="button"
                onClick={() => onRefresh()}
                className="text-xs px-2 py-1 rounded border border-[var(--border)] text-[var(--muted)] hover:text-white hover:bg-black/30"
              >
                Refresh
              </button>
            )}
            {run?.status === "completed" && run.id && (
              <Link
                href={`/benchmark/runs/${encodeURIComponent(run.id)}`}
                className="text-xs px-3 py-1 rounded-lg border border-[var(--border)] bg-black/30 text-white hover:bg-[var(--border)]"
              >
                View results
              </Link>
            )}
          </div>
        </div>
        {(run?.judge_model || run?.user_model) && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            {run.judge_model && <>Judge: {run.judge_model}</>}
            {run.judge_model && run.user_model && " · "}
            {run.user_model && <>User: {run.user_model}</>}
          </p>
        )}
        {showScenarioProgress && (
          <div className="mt-3 space-y-2">
            <p className="text-sm text-white tabular-nums">
              <span className="font-semibold">{scenariosCompleted}</span>
              <span className="text-[var(--muted)]"> / </span>
              <span className="font-semibold">{scenariosTotal}</span>
              <span className="text-[var(--muted)]"> scenarios tested</span>
            </p>
            {status === "running" && !cancelling && (
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/30">
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                  style={{
                    width: `${Math.min(100, Math.round((scenariosCompleted / scenariosTotal) * 100))}%`,
                  }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {(run?.error_message || pollError) && (
        <div className="border-b border-[var(--error)]/30 bg-[var(--error)]/10 px-4 py-3">
          <p className="text-sm font-medium text-[var(--error)]">Error</p>
          <p className="mt-1 text-sm text-[var(--text)] whitespace-pre-wrap break-words">
            {run?.error_message || pollError}
          </p>
        </div>
      )}

      <div className="px-4 py-2 border-b border-[var(--border)] bg-black/20">
        <span className="text-sm font-medium text-[var(--muted)]">Logs</span>
        <p className="text-[10px] text-[var(--muted)] mt-0.5">
          Live output from the benchmark worker. Persists if you leave and return
          to this page.
        </p>
      </div>
      <pre className="p-4 text-sm text-[var(--text)] overflow-auto max-h-[420px] min-h-[120px] font-mono whitespace-pre-wrap break-words bg-black/25">
        {run?.progress_log?.trim() ||
          (starting
            ? "Starting evaluation…"
            : cancelling
              ? "Cancelling evaluation…"
              : status === "pending"
                ? "Waiting for worker…"
                : "No log output yet.")}
        <div ref={logEndRef} />
      </pre>
    </div>
  );
}
