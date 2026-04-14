"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { ViewerDataExplorer } from "@/components/ViewerDataExplorer";
import type { ViewerData } from "@/lib/viewerDataFromZip";
import { humanizeSlug } from "@/lib/humanizeSlug";

export default function RunScenariosByRiskPage({
  params,
}: {
  params: Promise<{ evaluation_run_id: string; risk_category: string }>;
}) {
  const [serverData, setServerData] = useState<ViewerData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [evaluationRunId, setEvaluationRunId] = useState<string>("");
  const [riskCategory, setRiskCategory] = useState<string>("all");
  const router = useRouter();

  const data = serverData;
  const blockingError = !data && serverError;
  const loading = !data && serverLoading;
  const decodedRiskCategory = useMemo(
    () => (riskCategory === "all" ? "all" : decodeURIComponent(riskCategory)),
    [riskCategory]
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const resolved = await params;
      if (!cancelled) {
        setEvaluationRunId(resolved.evaluation_run_id || "");
        setRiskCategory(resolved.risk_category || "all");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params]);

  useEffect(() => {
    if (!evaluationRunId) return;
    let cancelled = false;
    fetch(`/api/evaluation-runs/${encodeURIComponent(evaluationRunId)}/viewer-data`)
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
          <h1 className="text-2xl font-bold text-white">Scenarios</h1>
          <p className="text-sm text-[var(--muted)]">
            {decodedRiskCategory === "all"
              ? "Showing all risk categories."
              : `Showing ${humanizeSlug(decodedRiskCategory)} scenarios.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href={`/benchmark/runs/${encodeURIComponent(evaluationRunId)}`}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Back to breakdown
          </Link>
        </div>
      </header>

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
        <ViewerDataExplorer
          data={data}
          selectedRiskCategoryId={decodedRiskCategory === "all" ? null : decodedRiskCategory}
          urlRiskCategory={decodedRiskCategory}
          onSubRiskSelectNavigateToCategory={(categoryId) => {
            const segment =
              categoryId === "all" ? "all" : encodeURIComponent(categoryId);
            router.replace(
              `/benchmark/runs/${encodeURIComponent(evaluationRunId)}/scenarios/${segment}`
            );
          }}
        />
      )}
    </div>
  );
}
