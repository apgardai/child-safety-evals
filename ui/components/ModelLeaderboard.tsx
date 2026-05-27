"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { DocLink, LeaderboardRow } from "data/leaderboardModels";
import { mainLeaderboardModels, otherLeaderboardModels } from "data/leaderboardModels";
import { leaderboardModelPath, modelIdForLeaderboardRow } from "lib/leaderboardRoutes";
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
  bestRun: EvaluationRunRow | null;
  modelId: string | null;
};

function LinkList({ title, links }: { title: string; links: DocLink[] }) {
  if (links.length === 0) return null;
  return (
    <div className="text-sm">
      <span className="text-[var(--muted)]">{title}: </span>
      <span className="inline-flex flex-wrap gap-x-3 gap-y-1">
        {links.map((l) => (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[var(--accent)] hover:underline"
          >
            {l.label}
          </a>
        ))}
      </span>
    </div>
  );
}

function ModelCard({ row }: { row: EnrichedRow }) {
  const headerScore =
    typeof row.bestScore === "number" ? `${Math.round(row.bestScore)}%` : "No runs yet";
  const detailHref = row.modelId ? leaderboardModelPath(row.modelId) : null;

  const cardInner = (
    <>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="font-semibold text-[var(--text)]">{row.provider}</h3>
          <p className="text-[var(--text)]/90 mt-0.5">{row.model}</p>
        </div>
        <div className="shrink-0 rounded-lg border border-[var(--border)] bg-[var(--gray-100)] px-3 py-1.5 text-center text-sm font-medium text-[var(--warning)]">
          Overall: {headerScore}
        </div>
      </div>
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
      <div className="text-xs text-[var(--muted)]">
        {row.runs.length} benchmark run{row.runs.length === 1 ? "" : "s"} linked
      </div>
      {detailHref ? (
        <span className="inline-block text-sm font-medium text-[var(--accent)]">
          View results →
        </span>
      ) : (
        <p className="text-sm text-[var(--muted)]">No benchmark results on disk yet.</p>
      )}
    </>
  );

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      {detailHref ? (
        <Link
          href={detailHref}
          className="block space-y-3 p-4 transition-colors hover:bg-[var(--gray-100)] md:p-5"
        >
          {cardInner}
        </Link>
      ) : (
        <div className="p-4 md:p-5 space-y-3">{cardInner}</div>
      )}
      <div className="border-t border-[var(--border)] px-4 pb-4 pt-3 md:px-5 md:pb-5 space-y-1.5">
        <LinkList title="API" links={row.apiLinks} />
        {row.inferenceLinks && row.inferenceLinks.length > 0 ? (
          <LinkList title="Inference" links={row.inferenceLinks} />
        ) : null}
        {row.notes ? (
          <p className="text-sm text-[var(--muted)]">
            <span className="text-[var(--muted)]">Note: </span>
            {row.notes}
          </p>
        ) : null}
      </div>
    </article>
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
          bestRun,
          modelId: modelIdForLeaderboardRow(row, bestRun),
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
    <section className="w-full space-y-6" aria-labelledby="leaderboard-heading">
      <div className="text-center space-y-2">
        <h2 id="leaderboard-heading" className="text-xl font-semibold text-[var(--text)] md:text-2xl">
          Youth Mental Wellbeing Leaderboard
        </h2>
        <p className="text-sm text-[var(--muted)] max-w-xl mx-auto">
          Models are ranked by highest overall benchmark score. Select a model to view risk
          breakdown and scenario assessments.
        </p>
      </div>
      <div className="space-y-3">
        {leaderboardRows.map((row) => (
          <ModelCard key={`${row.provider}-${row.model}`} row={row} />
        ))}
      </div>
    </section>
  );
}
