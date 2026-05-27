"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { PageContainer } from "components/PageContainer";
import requestsClient from "lib/requests-client";
import {
  EVALUATION_RUN_STATUS_META,
  normalizeEvaluationRunStatus,
  type EvaluationRunStatus,
} from "lib/evaluationRunStatus";

type EvaluationRunRow = {
  id: string;
  created_at: string;
  status?: string;
  target_model: string | null;
  judge_model: string | null;
  user_model: string | null;
  overall_score_pct?: number | null;
  error_message?: string | null;
};

function RunStatusBadge({
  status,
  errorMessage,
}: {
  status: EvaluationRunStatus;
  errorMessage?: string | null;
}) {
  const meta = EVALUATION_RUN_STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${meta.badgeClass}`}
      title={status === "failed" && errorMessage ? errorMessage : undefined}
    >
      {(status === "pending" || status === "running") && (
        <span
          className="inline-block h-2 w-2 animate-pulse rounded-full bg-current"
          aria-hidden
        />
      )}
      {meta.label}
    </span>
  );
}

export default function BenchmarkRunsPage() {
  const router = useRouter();
  const [rows, setRows] = useState<EvaluationRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await requestsClient.get<{ runs?: EvaluationRunRow[]; error?: string }>(
          "/api/evaluation-runs",
          { validateStatus: () => true }
        );
        const data = res.data ?? {};
        if (!cancelled) {
          if ((res.status < 200 || res.status >= 300) && data.error) setError(data.error);
          setRows(Array.isArray(data.runs) ? data.runs : []);
        }
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PageContainer>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">Evaluation Runs</h1>
          <p className="text-[var(--muted)] mt-1">
            Recent benchmark runs for your account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/benchmark"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)]"
          >
            Back to Benchmark
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-4 rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm text-[var(--warning)]">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-[var(--text)]">
            <thead className="bg-white">
              <tr className="text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Run ID</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Target</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Judge</th>
                <th className="px-4 py-3 font-medium text-right">Overall Score</th>
                <th className="px-4 py-3 font-medium">Created At</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-4 text-[var(--muted)]" colSpan={7}>
                    Loading runs...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-[var(--muted)]" colSpan={7}>
                    No runs found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const status = normalizeEvaluationRunStatus(r.status);
                  return (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--gray-100)] focus-within:bg-[var(--gray-100)]"
                    tabIndex={0}
                    onClick={() => router.push(`/benchmark/runs/${encodeURIComponent(r.id)}`)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        router.push(`/benchmark/runs/${encodeURIComponent(r.id)}`);
                      }
                    }}
                    aria-label={`Open evaluation run ${r.id}`}
                  >
                    <td className="px-4 py-3 font-mono text-xs text-[var(--accent)]">{r.id}</td>
                    <td className="px-4 py-3">
                      <RunStatusBadge
                        status={status}
                        errorMessage={r.error_message}
                      />
                    </td>
                    <td className="px-4 py-3">{r.target_model || "-"}</td>
                    <td className="px-4 py-3">{r.user_model || "-"}</td>
                    <td className="px-4 py-3">{r.judge_model || "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {typeof r.overall_score_pct === "number"
                        ? `${Math.round(r.overall_score_pct)}%`
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-[var(--muted)]">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PageContainer>
  );
}
