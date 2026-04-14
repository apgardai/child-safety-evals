"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ViewerDataExplorer } from "@/components/ViewerDataExplorer";
import type { ViewerData } from "@/lib/viewerDataFromZip";

export default function RunScenariosPage({
  params,
}: {
  params: Promise<{ evaluation_run_id: string }>;
}) {
  const [serverData, setServerData] = useState<ViewerData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [evaluationRunId, setEvaluationRunId] = useState<string>("");

  const data = serverData;
  const blockingError = !data && serverError;
  const loading = !data && serverLoading;

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
            Loads scenarios for the selected evaluation run.
          </p>
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

      {data && <ViewerDataExplorer data={data} />}
    </div>
  );
}
