"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import { ModelBenchmarkResults } from "components/ModelBenchmarkResults";
import { PageContainer } from "components/PageContainer";
import {
  findLeaderboardRowByModelId,
  leaderboardModelPath,
} from "lib/leaderboardRoutes";

export default function LeaderboardModelPage({
  params,
}: {
  params: Promise<{ model_id: string }>;
}) {
  const { model_id: modelIdRaw } = use(params);
  const modelId = decodeURIComponent(modelIdRaw ?? "").trim();

  const row = useMemo(() => findLeaderboardRowByModelId(modelId), [modelId]);
  const scenariosHref = `${leaderboardModelPath(modelId)}#scenarios`;

  return (
    <PageContainer className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          {row ? (
            <>
              <h1 className="text-2xl font-semibold text-[var(--text)]">{row.provider}</h1>
              <p className="text-[var(--text)]/90">{row.model}</p>
            </>
          ) : (
            <h1 className="text-2xl font-semibold text-[var(--text)]">{modelId}</h1>
          )}
          <p className="text-sm text-[var(--muted)]">
            Results from{" "}
            <code className="text-[var(--muted)]">benchmark/data/model-results/{modelId}/</code>
          </p>
        </div>
        <Link
          href="/"
          className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)]"
        >
          Leaderboard
        </Link>
      </header>

      <ModelBenchmarkResults modelId={modelId} scenariosHref={scenariosHref} />
    </PageContainer>
  );
}
