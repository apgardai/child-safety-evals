"use client";

import Link from "next/link";
import { use, useMemo } from "react";

import { ModelBenchmarkResults } from "components/ModelBenchmarkResults";
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
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href="/leaderboard" className="text-[var(--accent)] hover:underline">
          ← Leaderboard
        </Link>
      </div>

      <header className="space-y-1">
        {row ? (
          <>
            <h1 className="text-2xl font-semibold text-white">{row.provider}</h1>
            <p className="text-white/90">{row.model}</p>
          </>
        ) : (
          <h1 className="text-2xl font-semibold text-white">{modelId}</h1>
        )}
        <p className="text-sm text-[var(--muted)]">
          Results from{" "}
          <code className="text-white/80">benchmark/data/model-results/{modelId}/</code>
        </p>
      </header>

      <ModelBenchmarkResults modelId={modelId} scenariosHref={scenariosHref} />
    </div>
  );
}
