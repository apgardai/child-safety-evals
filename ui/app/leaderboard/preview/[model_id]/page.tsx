"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import type { BenchmarkId } from "data/benchmarks";
import { getBenchmarkDefinition } from "data/benchmarks";
import { ModelBenchmarkResults } from "components/ModelBenchmarkResults";
import { PageContainer } from "components/PageContainer";
import {
  leaderboardPreviewModelPath,
  resolveFilesystemModelId,
} from "lib/leaderboardRoutes";

const PREVIEW_BENCHMARK_ID: BenchmarkId = "csea";

function parseBenchmarkId(raw: string | null | undefined): BenchmarkId {
  const value = raw?.trim();
  if (value && getBenchmarkDefinition(value)) {
    return value as BenchmarkId;
  }
  return PREVIEW_BENCHMARK_ID;
}

export default function LeaderboardPreviewModelPage({
  params,
  searchParams,
}: {
  params: Promise<{ model_id: string }>;
  searchParams: Promise<{ benchmark?: string }>;
}) {
  const { model_id: modelIdRaw } = use(params);
  const { benchmark: benchmarkRaw } = use(searchParams);
  const modelId = resolveFilesystemModelId(
    decodeURIComponent(modelIdRaw ?? "").trim()
  );
  const benchmarkId = useMemo(() => parseBenchmarkId(benchmarkRaw), [benchmarkRaw]);
  const benchmark = getBenchmarkDefinition(benchmarkId);

  const scenariosHref = `${leaderboardPreviewModelPath(modelId, benchmarkId)}#scenarios`;

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-[var(--muted)]">
            {benchmark?.label ?? "Benchmark"} preview
          </p>
          <h2 className="text-2xl font-semibold text-[var(--text)]">Overview</h2>
        </div>
        <Link
          href="/sexual-safety"
          className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)]"
        >
          Leaderboard
        </Link>
      </header>

      <ModelBenchmarkResults
        modelId={modelId}
        scenariosHref={scenariosHref}
        benchmarkId={benchmarkId}
      />
    </PageContainer>
  );
}
