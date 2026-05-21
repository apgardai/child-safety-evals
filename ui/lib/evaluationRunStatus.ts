export type EvaluationRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export const EVALUATION_RUN_STATUS_META: Record<
  EvaluationRunStatus,
  { label: string; badgeClass: string; barClass: string }
> = {
  pending: {
    label: "Queued",
    badgeClass:
      "bg-amber-500/25 text-amber-200 border border-amber-500/50",
    barClass: "bg-amber-500/20 border-amber-500/40",
  },
  running: {
    label: "Running",
    badgeClass:
      "bg-[var(--accent)]/25 text-[var(--accent)] border border-[var(--accent)]/50",
    barClass: "bg-[var(--accent)]/15 border-[var(--accent)]/40",
  },
  completed: {
    label: "Completed",
    badgeClass:
      "bg-[var(--success)]/25 text-[var(--success)] border border-[var(--success)]/50",
    barClass: "bg-[var(--success)]/15 border-[var(--success)]/40",
  },
  failed: {
    label: "Failed",
    badgeClass:
      "bg-[var(--error)]/25 text-[var(--error)] border border-[var(--error)]/50",
    barClass: "bg-[var(--error)]/15 border-[var(--error)]/40",
  },
  cancelled: {
    label: "Cancelled",
    badgeClass:
      "bg-zinc-500/25 text-zinc-300 border border-zinc-500/50",
    barClass: "bg-zinc-500/20 border-zinc-500/40",
  },
};

export function normalizeEvaluationRunStatus(raw: string | undefined): EvaluationRunStatus {
  if (
    raw === "pending" ||
    raw === "running" ||
    raw === "completed" ||
    raw === "failed" ||
    raw === "cancelled"
  ) {
    return raw;
  }
  return "pending";
}
