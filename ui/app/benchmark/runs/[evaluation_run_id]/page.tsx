"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EvaluationRunResults } from "components/EvaluationRunResults";
import { PageContainer } from "components/PageContainer";

export default function EvaluationRunBreakdownPage({
  params,
}: {
  params: Promise<{ evaluation_run_id: string }>;
}) {
  const [evaluationRunId, setEvaluationRunId] = useState("");

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

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <h2 className="text-2xl font-semibold text-[var(--text)]">Overview</h2>
        <Link
          href="/benchmark/runs"
          className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)]"
        >
          Back
        </Link>
      </header>

      {evaluationRunId ? <EvaluationRunResults evaluationRunId={evaluationRunId} /> : null}
    </PageContainer>
  );
}
