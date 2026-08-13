"use client";

import Link from "next/link";
import { use } from "react";

import { DEFAULT_BENCHMARK_ID, getBenchmarkDefinition } from "data/benchmarks";
import { ModelBenchmarkResults } from "components/ModelBenchmarkResults";
import { PageContainer } from "components/PageContainer";
import { leaderboardModelPath } from "lib/leaderboardRoutes";

export default function LeaderboardModelPage({
  params,
}: {
  params: Promise<{ model_id: string }>;
}) {
  const { model_id: modelIdRaw } = use(params);
  const modelId = decodeURIComponent(modelIdRaw ?? "").trim();
  const benchmark = getBenchmarkDefinition(DEFAULT_BENCHMARK_ID);

  const scenariosHref = `${leaderboardModelPath(modelId)}#scenarios`;

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--muted)]">
            {benchmark?.label ?? "Benchmark"}
          </p>
          <h2 className="text-2xl font-semibold text-[var(--text)]">Overview</h2>
        </div>
        <Link
          href="/mental-wellbeing"
          className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)]"
        >
          Leaderboard
        </Link>
      </header>

      <ModelBenchmarkResults
        modelId={modelId}
        scenariosHref={scenariosHref}
        benchmarkId={DEFAULT_BENCHMARK_ID}
      />
    </PageContainer>
  );
}
