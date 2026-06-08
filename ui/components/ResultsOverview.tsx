"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ScoreViewToggle } from "components/ScoreViewToggle";
import {
  buildRiskScoreRows,
  hasChildBenchmarkScores,
  overallScoreStats,
  pctForRiskRow,
  riskCategorySortIndex,
  type ScoreViewMode,
} from "lib/benchmarkScoreViews";
import { humanizeSlug } from "lib/humanizeSlug";
import type { ViewerData } from "lib/viewerDataFromZip";

type SelectedRisk = { riskCategoryId: string; riskId: string };

function ScorePercentBar({
  pct,
  variant = "default",
}: {
  pct: number;
  variant?: "default" | "child" | "composite";
}) {
  const w = Math.max(0, Math.min(100, pct));
  const label =
    variant === "child"
      ? "Child-aware"
      : variant === "composite"
        ? "Composite"
        : "Assistant";
  const gradientClass =
    variant === "child"
      ? "bg-gradient-to-r from-sky-400 to-emerald-500"
      : "bg-gradient-to-r from-[var(--error)] via-[var(--warning)] to-[var(--success)]";
  return (
    <div
      className="h-2.5 w-full rounded-full bg-[var(--border)]/60 overflow-hidden cursor-default"
      title={`${label} · ${pct.toFixed(0)}%`}
      aria-label={`${label} score: ${pct.toFixed(0)}%`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${gradientClass}`}
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

function barVariantForMode(mode: ScoreViewMode): "default" | "child" | "composite" {
  if (mode === "child") return "child";
  if (mode === "composite") return "composite";
  return "default";
}

export function ResultsOverview({
  data,
  scenariosHref = "/scenarios",
  uploadBusy = false,
  onUploadZip,
  uploadLabel,
  showScenariosCta = true,
  onSelectRisk,
  scoreView: controlledScoreView,
  onScoreViewChange,
  showScoreToggles = true,
}: {
  data: ViewerData;
  scenariosHref?: string;
  uploadBusy?: boolean;
  uploadLabel?: string;
  onUploadZip?: (file: File) => void;
  showScenariosCta?: boolean;
  onSelectRisk?: (risk: SelectedRisk) => void;
  scoreView?: ScoreViewMode;
  onScoreViewChange?: (mode: ScoreViewMode) => void;
  /** When false, score toggles are shown only in the parent overview header. */
  showScoreToggles?: boolean;
}) {
  const scores = useMemo(() => data.summary?.scores ?? [], [data]);
  const taxonomy = useMemo(() => data.risks ?? [], [data]);
  const hasChildScores = useMemo(
    () => hasChildBenchmarkScores(scores, data.summary?.prompts),
    [scores, data.summary?.prompts]
  );

  const [internalScoreView, setInternalScoreView] = useState<ScoreViewMode>("composite");
  const scoreView = controlledScoreView ?? internalScoreView;
  const setScoreView = onScoreViewChange ?? setInternalScoreView;
  const activeView: ScoreViewMode = hasChildScores
    ? scoreView
    : scoreView === "child"
      ? "default"
      : scoreView;

  const categoryNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of taxonomy) {
      if (!c?.id) continue;
      map.set(c.id, c.name || c.id);
    }
    return map;
  }, [taxonomy]);

  const riskNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of taxonomy) {
      if (!c?.id) continue;
      for (const r of c.risks ?? []) {
        if (!r?.id) continue;
        map.set(`${c.id}:${r.id}`, r.name || r.id);
      }
    }
    return map;
  }, [taxonomy]);

  const riskRows = useMemo(() => buildRiskScoreRows(scores), [scores]);

  const riskItems = useMemo(() => {
    return riskRows
      .map((row) => {
        const categoryName = categoryNameById.get(row.category) || row.category;
        const fromTax = riskNameByKey.get(`${row.category}:${row.risk}`);
        const riskDisplayName =
          fromTax && fromTax !== row.risk ? fromTax : humanizeSlug(row.risk);
        return {
          ...row,
          categoryName,
          riskName: riskDisplayName,
        };
      })
      .sort((a, b) => {
        const cat = riskCategorySortIndex(a.category) - riskCategorySortIndex(b.category);
        if (cat !== 0) return cat;
        return a.riskName.localeCompare(b.riskName);
      });
  }, [riskRows, categoryNameById, riskNameByKey]);

  const groupedRiskItems = useMemo(() => {
    const grouped = new Map<string, { categoryLabel: string; items: typeof riskItems }>();
    for (const item of riskItems) {
      const current = grouped.get(item.category);
      if (current) {
        current.items.push(item);
      } else {
        grouped.set(item.category, {
          categoryLabel: item.categoryName,
          items: [item],
        });
      }
    }
    return Array.from(grouped.entries()).map(([categoryId, value]) => ({
      categoryId,
      categoryLabel: value.categoryLabel,
      items: value.items,
    }));
  }, [riskItems]);

  const overallStats = useMemo(() => overallScoreStats(riskRows), [riskRows]);

  const activeOverallPct =
    activeView === "default"
      ? overallStats.defaultPct
      : activeView === "child"
        ? overallStats.childPct
        : overallStats.compositePct;

  const showToolbar = Boolean(onUploadZip || showScenariosCta);
  const barVariant = barVariantForMode(activeView);

  const scoreViewDescription =
    activeView === "composite"
      ? "Combined across Assistant and child-aware prompt variants."
      : activeView === "default"
        ? "Assistant only — model is not told it is talking to a child."
        : "Child-aware prompt only — model is told it is talking to a child.";

  return (
    <div className="space-y-5">
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onUploadZip && (
            <label className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)] cursor-pointer">
              {uploadBusy ? "Uploading..." : "Upload .zip"}
              <input
                type="file"
                accept=".zip,application/zip"
                className="sr-only"
                disabled={uploadBusy}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadZip(file);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          )}
          {showScenariosCta ? (
            <Link
              href={scenariosHref}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              View scenarios
            </Link>
          ) : null}
        </div>
      ) : null}
      {uploadLabel && (
        <div className="text-xs text-[var(--muted)]">
          Dataset: <span className="text-[var(--text)]/90">{uploadLabel}</span>
        </div>
      )}

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold text-[var(--text)]">Risk breakdown</h2>
        {showScoreToggles && hasChildScores ? (
          <ScoreViewToggle
            mode={activeView}
            onChange={setScoreView}
            hasChildScores={hasChildScores}
            layout="cards"
          />
        ) : null}
        <p className="text-xs text-[var(--muted)]">
          {scoreViewDescription}{" "}
          {onSelectRisk ? (
            <span className="text-[var(--muted)]">Click a row to filter scenarios below.</span>
          ) : null}
        </p>

        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5 overflow-x-auto -mx-1 px-1">
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
                  Score mix
                </th>
                <th scope="col" className="py-2.5 px-2 text-right font-medium align-bottom w-14 tabular-nums">
                  Score
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]/70">
              <tr className="bg-[var(--gray-100)]">
                <td colSpan={2} className="py-3 pr-3 align-middle font-semibold text-[var(--text)]">
                  Overall
                </td>
                <td className="py-3 pr-3 align-middle text-xs text-[var(--muted)]">
                  {activeView === "composite"
                    ? "All prompt variants"
                    : activeView === "default"
                      ? "Assistant only"
                      : "Child-aware only"}
                </td>
                <td className="py-3 px-2 align-middle">
                  <ScorePercentBar pct={activeOverallPct} variant={barVariant} />
                </td>
                <td className="py-3 px-2 align-middle text-right">
                  <span className="text-xl font-bold tabular-nums text-[var(--text)]">
                    {activeOverallPct.toFixed(0)}%
                  </span>
                </td>
              </tr>

              {groupedRiskItems.flatMap((group) => {
                const categoryTitle =
                  group.categoryLabel !== group.categoryId
                    ? group.categoryLabel
                    : humanizeSlug(group.categoryId);
                const n = group.items.length;
                return group.items.map((r, i) => {
                  const rowPct = pctForRiskRow(r, activeView);
                  const interactive = Boolean(onSelectRisk);
                  const rowClass = [
                    "transition-colors",
                    interactive ? "cursor-pointer hover:bg-[var(--gray-100)]" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  function activate() {
                    onSelectRisk?.({
                      riskCategoryId: r.category,
                      riskId: r.risk,
                    });
                  }

                  return (
                    <tr
                      key={r.key}
                      className={rowClass}
                      onClick={interactive ? activate : undefined}
                      onKeyDown={
                        interactive
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                activate();
                              }
                            }
                          : undefined
                      }
                      tabIndex={interactive ? 0 : undefined}
                      role={interactive ? "button" : undefined}
                    >
                      {i === 0 ? (
                        <td
                          rowSpan={n}
                          className="align-top border-r border-[var(--border)]/50 py-2.5 pr-3 text-[var(--text)] font-medium leading-snug"
                        >
                          {categoryTitle}
                        </td>
                      ) : null}
                      <td className="py-2.5 px-1 text-center text-xs tabular-nums text-[var(--muted)] align-top">
                        {i + 1}
                      </td>
                      <td className="py-2.5 pr-3 align-top min-w-0">
                        <div className="font-medium text-[var(--text)] leading-snug break-words">
                          {r.riskName}
                        </div>
                        {onSelectRisk ? (
                          <div className="mt-1 text-[10px] text-[var(--accent)]">Scenarios →</div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-2 align-middle">
                        <ScorePercentBar pct={rowPct} variant={barVariant} />
                      </td>
                      <td className="py-2.5 px-2 align-middle text-right">
                        <span className="font-semibold tabular-nums text-[var(--text)]">
                          {rowPct.toFixed(0)}%
                        </span>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
