"use client";

import { BENCHMARKS, DEFAULT_BENCHMARK_ID } from "data/benchmarks";
import { LeaderboardSidebar } from "components/LeaderboardSidebar";
import { ModelLeaderboard } from "components/ModelLeaderboard";
import { PageContainer } from "components/PageContainer";

const wellbeingBenchmark =
  BENCHMARKS.find((b) => b.id === DEFAULT_BENCHMARK_ID) ?? BENCHMARKS[0];

export function LeaderboardPage() {
  return (
    <PageContainer className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">
          {wellbeingBenchmark.label} Benchmark
        </h1>
        <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
          See how frontier models perform using an expert-informed taxonomy you can run
          yourself.
        </p>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
        <LeaderboardSidebar benchmarkId={DEFAULT_BENCHMARK_ID} />
        <div className="min-w-0">
          <ModelLeaderboard />
        </div>
      </div>
    </PageContainer>
  );
}
