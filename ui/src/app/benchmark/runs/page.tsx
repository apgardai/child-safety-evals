"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type EvaluationRunRow = {
  id: string;
  created_at: string;
  target_model: string | null;
  judge_model: string | null;
  user_model: string | null;
  overall_score_pct?: number | null;
};

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
        const res = await fetch("/api/evaluation-runs");
        const data = (await res.json().catch(() => ({}))) as {
          runs?: EvaluationRunRow[];
          error?: string;
        };
        if (!cancelled) {
          if (!res.ok && data.error) setError(data.error);
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
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Evaluation Runs</h1>
          <p className="text-[var(--muted)] mt-1">
            Recent benchmark runs for your account.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/benchmark"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
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
          <table className="min-w-full text-sm text-white">
            <thead className="bg-black/30">
              <tr className="text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium">Run ID</th>
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
                  <td className="px-4 py-4 text-[var(--muted)]" colSpan={6}>
                    Loading runs...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-4 text-[var(--muted)]" colSpan={6}>
                    No runs found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-[var(--border)] cursor-pointer hover:bg-white/5 focus-within:bg-white/5"
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
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
