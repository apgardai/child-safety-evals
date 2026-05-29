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
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-[var(--muted)]">Overall score</span>
        <span className="shrink-0 font-semibold tabular-nums text-[var(--text)]">
          {pct != null ? `${pct}%` : "No runs yet"}
        </span>
      </div>
      <div
        className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--gray-100)]"
        role="progressbar"
        aria-valuenow={pct ?? 0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={pct != null ? `Overall score ${pct} percent` : "No benchmark runs yet"}
      >
        <div
          className={[
            "h-full rounded-full transition-[width] duration-300",
            pct != null ? "bg-[var(--accent)]" : "bg-transparent",
          ].join(" ")}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function ModelCardContent({ row }: { row: EnrichedRow }) {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-[var(--text)]">{row.provider}</h3>
        <p className="mt-0.5 text-[var(--text)]/90">{row.model}</p>
      </div>

      <ScoreBar score={row.bestScore} />

      <dl className="grid gap-1 text-sm text-[var(--muted)] sm:grid-cols-3">
        <div>
          <dt className="sr-only">Date</dt>
          <dd>
            <span className="text-[var(--muted)]">Date: </span>
            {row.date}
          </dd>
        </div>
        <div>
          <dt className="sr-only">Size</dt>
          <dd>
            <span className="text-[var(--muted)]">Size: </span>
            {row.size}
          </dd>
        </div>
        <div>
          <dt className="sr-only">License</dt>
          <dd>
            <span className="text-[var(--muted)]">License: </span>
            {row.license}
          </dd>
        </div>
      </dl>

      <p className="text-xs text-[var(--muted)]">
        {row.runs.length} benchmark run{row.runs.length === 1 ? "" : "s"} linked
      </p>

      {row.notes ? (
        <p className="text-sm text-[var(--muted)]">
          <span className="text-[var(--muted)]">Note: </span>
          {row.notes}
        </p>
      ) : null}
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
  const label = `${row.provider} — ${row.model}`;

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
