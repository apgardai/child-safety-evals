"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { LeaderboardRow } from "data/leaderboardModels";
import { mainLeaderboardModels, otherLeaderboardModels } from "data/leaderboardModels";
import {
  leaderboardModelPath,
  modelIdForLeaderboardRow,
} from "lib/leaderboardRoutes";
import requestsClient from "lib/requests-client";
import { resolveLeaderboardRowForTarget } from "lib/resolveLeaderboardProfile";

type EvaluationRunRow = {
  id: string;
  created_at: string;
  target_model: string | null;
  overall_score_pct?: number | null;
  source?: "local-file";
  model_dir?: string | null;
};

type EnrichedRow = LeaderboardRow & {
  runs: EvaluationRunRow[];
  bestScore: number | null;
};

function ScoreBar({ score }: { score: number | null }) {
  const pct = typeof score === "number" ? Math.round(score) : null;
  const width = pct != null ? Math.min(100, Math.max(0, pct)) : 0;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>Composite score</span>
        <span className="shrink-0 font-semibold tabular-nums text-[var(--text)]">
          {pct != null ? `${pct}%` : "—"}
        </span>
      </div>
      <div
        className="h-2.5 min-w-0 overflow-hidden rounded-full bg-[var(--gray-100)]"
        role="progressbar"
        aria-valuenow={pct ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={
          pct != null ? `Composite score ${pct} percent` : "No benchmark runs yet"
        }
      >
        <div
          className={[
            "h-full rounded-full transition-[width] duration-300",
            pct != null
              ? "bg-gradient-to-r from-[var(--error)] via-[var(--warning)] to-[var(--success)]"
              : "bg-transparent",
          ].join(" ")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ModelCardContent({ row }: { row: EnrichedRow }) {
  return (
    <div className="space-y-2">
      <h3 className="font-semibold text-[var(--text)]">
        <span>{row.provider}</span>
        <span className="font-normal text-[var(--muted)]"> / </span>
        <span className="font-medium text-[var(--text)]/90">{row.model}</span>
      </h3>
      <ScoreBar score={row.bestScore} />
    </div>
  );
}

const modelCardClassName =
  "block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors md:p-5";

function ModelCard({ row }: { row: EnrichedRow }) {
  const bestRun = row.runs[0] ?? null;
  const modelId = modelIdForLeaderboardRow(row, bestRun);

  if (!modelId) {
    return (
      <article className={modelCardClassName}>
        <ModelCardContent row={row} />
      </article>
    );
  }

  const href = leaderboardModelPath(modelId);
  const label = `${row.provider} / ${row.model}`;

  return (
    <Link
      href={href}
      aria-label={`View benchmark results for ${label}`}
      className={[
        modelCardClassName,
        "cursor-pointer hover:border-[var(--accent)]/40 hover:bg-[var(--gray-100)]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/50",
      ].join(" ")}
    >
      <article>
        <ModelCardContent row={row} />
      </article>
    </Link>
  );
}

export function ModelLeaderboard() {
  const [runs, setRuns] = useState<EvaluationRunRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [res, localRes] = await Promise.all([
          requestsClient.get<{ runs?: EvaluationRunRow[] }>("/api/evaluation-runs", {
            validateStatus: () => true,
          }),
          requestsClient.get<{ runs?: EvaluationRunRow[] }>("/api/model-results", {
            validateStatus: () => true,
          }),
        ]);
        const localRuns = Array.isArray(localRes.data?.runs) ? localRes.data.runs : [];
        const dbRuns = Array.isArray(res.data?.runs) ? res.data.runs : [];
        if (cancelled) return;
        const mergedById = new Map<string, EvaluationRunRow>();
        for (const run of [...localRuns, ...dbRuns]) {
          mergedById.set(run.id, run);
        }
        setRuns(Array.from(mergedById.values()));
      } catch {
        if (!cancelled) setRuns([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const leaderboardRows = useMemo(() => {
    const baseRows = [...mainLeaderboardModels, ...otherLeaderboardModels];
    return baseRows
      .map((row): EnrichedRow => {
        const matchingRuns = runs
          .filter((run) => {
            const matched = resolveLeaderboardRowForTarget(run.target_model ?? "");
            return matched?.provider === row.provider && matched?.model === row.model;
          })
          .sort((a, b) => {
            const scoreA = typeof a.overall_score_pct === "number" ? a.overall_score_pct : -1;
            const scoreB = typeof b.overall_score_pct === "number" ? b.overall_score_pct : -1;
            if (scoreA !== scoreB) return scoreB - scoreA;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
          });

        const bestRun = matchingRuns[0] ?? null;
        return {
          ...row,
          runs: matchingRuns,
          bestScore:
            typeof bestRun?.overall_score_pct === "number"
              ? bestRun.overall_score_pct
              : null,
        };
      })
      .sort((a, b) => {
        const scoreA = typeof a.bestScore === "number" ? a.bestScore : -1;
        const scoreB = typeof b.bestScore === "number" ? b.bestScore : -1;
        if (scoreA !== scoreB) return scoreB - scoreA;
        return a.provider.localeCompare(b.provider);
      });
  }, [runs]);

  return (
    <section className="w-full space-y-3" aria-label="Model results">
      {leaderboardRows.map((row) => (
        <ModelCard key={`${row.provider}-${row.model}`} row={row} />
      ))}
    </section>
  );
}
