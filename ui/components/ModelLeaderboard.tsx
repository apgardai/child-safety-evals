 "use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { DocLink, LeaderboardRow } from "data/leaderboardModels";
import { mainLeaderboardModels, otherLeaderboardModels } from "data/leaderboardModels";
import { humanizeSlug } from "lib/humanizeSlug";
import requestsClient from "lib/requests-client";
import { resolveLeaderboardRowForTarget } from "lib/resolveLeaderboardProfile";

type EvaluationRunRow = {
  id: string;
  created_at: string;
  target_model: string | null;
  overall_score_pct?: number | null;
  source?: "local-file";
  risk_scores?: Array<{
    risk_category_id: string;
    overall_score_pct: number;
  }>;
  risk_items?: Array<{
    risk_category_id: string;
    risk_id: string;
    overall_score_pct: number;
  }>;
};

type LocalResultRunRow = EvaluationRunRow & {
  source?: "local-file";
};

type EnrichedRow = LeaderboardRow & {
  runs: EvaluationRunRow[];
  bestScore: number | null;
  bestRun: EvaluationRunRow | null;
};

function ScorePercentBar({ pct }: { pct: number }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-3 w-full rounded-full bg-[var(--border)]/60 overflow-hidden" aria-hidden>
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--error)] via-[var(--warning)] to-[var(--success)] transition-[width] duration-300"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function RunRiskTable({ run }: { run: EvaluationRunRow }) {
  const riskItems = Array.isArray(run.risk_items) ? run.risk_items : [];
  const grouped = new Map<string, typeof riskItems>();
  for (const item of riskItems) {
    const current = grouped.get(item.risk_category_id) ?? [];
    current.push(item);
    grouped.set(item.risk_category_id, current);
  }
  const categories = Array.from(grouped.entries());
  return (
    <div className="overflow-x-auto -mx-1 px-1 mt-2">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-[10px] uppercase tracking-wide text-[var(--muted)]">
            <th scope="col" className="py-2.5 pr-3 text-left font-medium align-bottom min-w-[7rem]">
              High-level category
            </th>
            <th scope="col" className="py-2.5 px-1 text-center font-medium align-bottom w-9">
              #
            </th>
            <th scope="col" className="py-2.5 pr-3 text-left font-medium align-bottom min-w-[11rem]">
              Mid-level risk
            </th>
            <th
              scope="col"
              className="py-2.5 px-2 text-left font-medium align-bottom min-w-[6.5rem] w-[24%]"
            >
              Mix
            </th>
            <th scope="col" className="py-2.5 px-2 text-right font-medium align-bottom w-14 tabular-nums">
              Score
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--border)]/70">
          <tr className="bg-black/[0.12]">
            <td colSpan={2} className="py-3 pr-3 align-middle font-semibold text-white">
              Overall
            </td>
            <td className="py-3 pr-3 align-middle text-xs text-[var(--muted)]">
              All groups combined
            </td>
            <td className="py-3 px-2 align-middle">
              <ScorePercentBar pct={run.overall_score_pct ?? 0} />
            </td>
            <td className="py-3 px-2 align-middle text-right text-xl font-bold tabular-nums text-white">
              {typeof run.overall_score_pct === "number"
                ? `${Math.round(run.overall_score_pct)}%`
                : "-"}
            </td>
          </tr>
          {categories.flatMap(([categoryId, items]) =>
            items.map((item, idx) => (
              <tr key={`${run.id}-${categoryId}-${item.risk_id}-${idx}`}>
                {idx === 0 ? (
                  <td
                    rowSpan={items.length}
                    className="align-top border-r border-[var(--border)]/50 py-2.5 pr-3 text-white font-medium leading-snug"
                  >
                    {humanizeSlug(categoryId)}
                  </td>
                ) : null}
                <td className="py-2.5 px-1 text-center text-xs tabular-nums text-[var(--muted)] align-top">
                  {idx + 1}
                </td>
                <td className="py-2.5 pr-3 align-top min-w-0">
                  <div className="font-medium text-white leading-snug break-words">
                    {humanizeSlug(item.risk_id)}
                  </div>
                </td>
                <td className="py-2.5 px-2 align-middle">
                  <ScorePercentBar pct={item.overall_score_pct} />
                </td>
                <td className="py-2.5 px-2 align-middle text-right font-semibold tabular-nums text-white">
                  {Math.round(item.overall_score_pct)}%
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

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

function ModelCard({
  row,
  expanded,
  onToggle,
}: {
  row: EnrichedRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const headerScore =
    typeof row.bestScore === "number" ? `${Math.round(row.bestScore)}%` : "No runs yet";

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
      <button
        type="button"
        onClick={onToggle}
        className="w-full p-4 md:p-5 text-left space-y-3 hover:bg-white/[0.03] transition-colors"
        aria-expanded={expanded}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="font-semibold text-white">{row.provider}</h3>
            <p className="text-white/90 mt-0.5">{row.model}</p>
          </div>
          <div className="shrink-0 rounded-lg border border-[var(--border)] bg-black/25 px-3 py-1.5 text-center text-sm font-medium text-[var(--warning)]">
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
      </button>

      {expanded ? (
        <div className="border-t border-[var(--border)] px-4 pb-4 pt-3 md:px-5 md:pb-5 space-y-3">
          {row.bestRun ? (
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={
                  row.bestRun.source === "local-file"
                    ? `/test-results?runId=${encodeURIComponent(row.bestRun.id)}`
                    : `/benchmark/runs/${encodeURIComponent(row.bestRun.id)}/scenarios/all`
                }
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                View scenarios
              </Link>
            </div>
          ) : null}

          <div className="space-y-1.5">
            <LinkList title="API" links={row.apiLinks} />
            {row.inferenceLinks && row.inferenceLinks.length > 0 ? (
              <LinkList title="Inference" links={row.inferenceLinks} />
            ) : null}
            {row.notes ? (
              <p className="text-sm text-[var(--muted)]">
                <span className="text-white/70">Note: </span>
                {row.notes}
              </p>
            ) : null}
          </div>

          {row.runs.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">No benchmark runs yet for this model.</p>
          ) : (
            <div className="space-y-2">
              {row.runs.slice(0, 8).map((run) => (
                <div
                  key={run.id}
                  className="rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium text-white">Overall</span>
                    <span className="font-semibold text-white">
                      {typeof run.overall_score_pct === "number"
                        ? `${Math.round(run.overall_score_pct)}%`
                        : "-"}
                    </span>
                  </div>
                  <div className="mt-1">
                    <ScorePercentBar pct={run.overall_score_pct ?? 0} />
                  </div>
                  {Array.isArray(run.risk_items) && run.risk_items.length > 0 ? (
                    <RunRiskTable run={run} />
                  ) : null}
                  <div className="mt-2 flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
                    <span>{new Date(run.created_at).toLocaleString()}</span>
                    {run.source === "local-file" ? (
                      <Link
                        href={`/test-results?runId=${encodeURIComponent(run.id)}`}
                        className="text-[var(--accent)] hover:underline"
                      >
                        Open scenarios
                      </Link>
                    ) : (
                      <Link
                        href={`/benchmark/runs/${encodeURIComponent(run.id)}`}
                        className="text-[var(--accent)] hover:underline"
                      >
                        Open run
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </article>
  );
}

export function ModelLeaderboard() {
  const [runs, setRuns] = useState<EvaluationRunRow[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await requestsClient.get<{ runs?: EvaluationRunRow[] }>("/api/evaluation-runs", {
          validateStatus: () => true,
        });
        const localRes = await fetch("/api/model-results", { method: "GET" });
        const localJson = (await localRes.json().catch(() => ({}))) as {
          runs?: LocalResultRunRow[];
        };
        const localRuns = Array.isArray(localJson.runs) ? localJson.runs : [];
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

        return {
          ...row,
          runs: matchingRuns,
          bestScore:
            typeof matchingRuns[0]?.overall_score_pct === "number"
              ? matchingRuns[0].overall_score_pct
              : null,
          bestRun: matchingRuns[0] ?? null,
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
    <section className="w-full max-w-4xl space-y-6" aria-labelledby="leaderboard-heading">
      <div className="text-center space-y-2">
        <h2 id="leaderboard-heading" className="text-xl font-semibold text-white md:text-2xl">
          Model leaderboard
        </h2>
        <p className="text-sm text-[var(--muted)] max-w-xl mx-auto">
          Models are ranked by highest overall benchmark score. Click a model card to view linked
          run results and jump directly to scenarios.
        </p>
      </div>
      <div className="space-y-3">
        {leaderboardRows.map((row) => (
          <ModelCard
            key={`${row.provider}-${row.model}`}
            row={row}
            expanded={expandedKey === `${row.provider}-${row.model}`}
            onToggle={() =>
              setExpandedKey((prev) =>
                prev === `${row.provider}-${row.model}`
                  ? null
                  : `${row.provider}-${row.model}`
              )
            }
          />
        ))}
      </div>
    </section>
  );
}
