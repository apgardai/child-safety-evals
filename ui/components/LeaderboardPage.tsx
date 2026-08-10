"use client";

import { getBenchmarkDefinition, type BenchmarkId } from "data/benchmarks";
import { BenchmarkToggle } from "components/BenchmarkToggle";
import { LeaderboardSidebar } from "components/LeaderboardSidebar";
import { ModelLeaderboard } from "components/ModelLeaderboard";
import { PageContainer } from "components/PageContainer";
import { UserModelScoreCard } from "components/UserModelScoreCard";

export function LeaderboardPage({
  benchmarkId,
}: {
  benchmarkId: BenchmarkId;
}) {
  const benchmark = getBenchmarkDefinition(benchmarkId);

  return (
    <PageContainer className="space-y-8">
      <div className="mx-auto w-full max-w-xl">
        <BenchmarkToggle activeId={benchmarkId} />
      </div>
      <header className="grid items-start gap-6 lg:grid-cols-2 lg:gap-10">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-brand-dark md:text-3xl">
            {benchmark?.label ?? "Benchmark"} Benchmark
          </h1>
          <p className="max-w-3xl text-sm leading-relaxed text-[var(--muted)] md:text-base">
            See how frontier models perform using an expert-informed taxonomy you can run yourself.
          </p>
        </div>
        <div className="min-w-0 lg:justify-self-end lg:w-full lg:max-w-md">
          <UserModelScoreCard />
        </div>
      </header>
      <div className="grid items-start gap-8 lg:grid-cols-2 lg:gap-10 xl:gap-12">
        <LeaderboardSidebar benchmarkId={benchmarkId} />
        <div className="min-w-0">
          <ModelLeaderboard benchmarkId={benchmarkId} />
        </div>
      </div>
    </PageContainer>
  );
}
