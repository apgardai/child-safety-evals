"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { apiUrl } from "lib/api-url";
import type { ViewerData } from "lib/viewerDataFromZip";
import { humanizeSlug } from "lib/humanizeSlug";

function safetyCompositePct(f: number, a: number, e: number): number {
  const total = f + a + e;
  if (total === 0) return 0;
  const points = a + e * 2;
  return (points / (total * 2)) * 100;
}

export default function RunScenariosPage({
  params,
}: {
  params: Promise<{ evaluation_run_id: string }>;
}) {
  const router = useRouter();
  const [serverData, setServerData] = useState<ViewerData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [evaluationRunId, setEvaluationRunId] = useState<string>("");

  const data = serverData;
  const blockingError = !data && serverError;
  const loading = !data && serverLoading;
  const riskRows = useMemo(() => {
    const scores = data?.summary?.scores ?? [];
    const byCategory = new Map<string, { failing: number; adequate: number; exemplary: number }>();

    for (const row of scores) {
      const category = row.riskCategoryId || "unknown";
      const sums = row.sums?.as ?? [0, 0, 0];
      const existing = byCategory.get(category) ?? { failing: 0, adequate: 0, exemplary: 0 };
      existing.failing += sums[0] ?? 0;
      existing.adequate += sums[1] ?? 0;
      existing.exemplary += sums[2] ?? 0;
      byCategory.set(category, existing);
    }

    return Array.from(byCategory.entries())
      .map(([category, counts]) => ({
        category,
        label: humanizeSlug(category),
        failing: counts.failing,
        adequate: counts.adequate,
        exemplary: counts.exemplary,
        total: counts.failing + counts.adequate + counts.exemplary,
        pct: safetyCompositePct(counts.failing, counts.adequate, counts.exemplary),
      }))
      .sort((a, b) => b.total - a.total);
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolved = await params;
      if (!cancelled) setEvaluationRunId(resolved.evaluation_run_id || "");
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!evaluationRunId) return;
    let cancelled = false;
    fetch(apiUrl(`/api/evaluation-runs/${encodeURIComponent(evaluationRunId)}/viewer-data`), {
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || `Failed with ${r.status}`);
        }
        return r.json();
      })
      .then((j: ViewerData) => {
        if (!cancelled) setServerData(j);
      })
      .catch((e) => {
        if (!cancelled) setServerError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setServerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [evaluationRunId]);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Risk Breakdown</h1>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/benchmark/runs"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Back
          </Link>
        </div>
      </header>

      {evaluationRunId && (
        <div className="mb-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-white">
          Viewing evaluation run:{" "}
          <span className="font-medium text-[var(--accent)]">{evaluationRunId}</span>
        </div>
      )}

      {blockingError && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--error)] mb-4">
          {blockingError}
        </div>
      )}

      {loading && !data && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)]">
          Loading...
        </div>
      )}

      {!loading && !data && !blockingError && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)] space-y-2">
          <p>No scenarios found for this evaluation run.</p>
        </div>
      )}

      {data && (
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
            <Link
              href={`/benchmark/runs/${encodeURIComponent(evaluationRunId)}/scenarios/all`}
              className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
            >
              View all scenarios
            </Link>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-sm text-white">
              <thead className="border-b border-[var(--border)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Risk Category</th>
                  <th className="px-3 py-2 text-right font-medium">Failing</th>
                  <th className="px-3 py-2 text-right font-medium">Adequate</th>
                  <th className="px-3 py-2 text-right font-medium">Exemplary</th>
                  <th className="px-3 py-2 text-right font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {riskRows.map((r) => (
                  <tr
                    key={r.category}
                    className="cursor-pointer border-b border-[var(--border)]/60 hover:bg-white/5"
                    onClick={() =>
                      router.push(
                        `/benchmark/runs/${encodeURIComponent(evaluationRunId)}/scenarios/${encodeURIComponent(
                          r.category
                        )}`
                      )
                    }
                  >
                    <td className="px-3 py-2">{r.label}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.failing}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.adequate}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.exemplary}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{r.pct.toFixed(0)}%</td>
                  </tr>
                ))}
                {riskRows.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-[var(--muted)]">
                      No risk scores available for this run.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
