"use client";

import Link from "next/link";
import { useMemo } from "react";
import { humanizeSlug } from "lib/humanizeSlug";
import type { ViewerData } from "lib/viewerDataFromZip";

/** Graded scoring: failing=0, adequate=1, exemplary=2 pts; max = tests * 2 */
function safetyCompositePct(f: number, a: number, e: number): number {
  const total = f + a + e;
  if (total === 0) return 0;
  const points = f * 0 + a * 1 + e * 2;
  return (points / (total * 2)) * 100;
}

type SelectedRisk = { riskCategoryId: string; riskId: string };

function ScorePercentBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, pct));
  return (
    <div
      className="h-3 w-full rounded-full bg-[var(--border)]/60 overflow-hidden"
      aria-hidden
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-[var(--error)] via-[var(--warning)] to-[var(--success)] transition-[width] duration-300"
        style={{ width: `${w}%` }}
      />
    </div>
  );
}

export function ResultsOverview({
  data,
  scenariosHref = "/scenarios",
  uploadBusy = false,
  onUploadZip,
  uploadLabel,
  showScenariosCta = true,
  onSelectRisk,
}: {
  data: ViewerData;
  /** Link to scenarios tab for this dataset */
  scenariosHref?: string;
  uploadBusy?: boolean;
  uploadLabel?: string;
  onUploadZip?: (file: File) => void;
  /** When false, hides the “View scenarios” button (e.g. explorer is on the same page). */
  showScenariosCta?: boolean;
  /** Optional click handler for per-risk rows. */
  onSelectRisk?: (risk: SelectedRisk) => void;
}) {
  const scores = useMemo(() => data.summary?.scores ?? [], [data]);
  const taxonomy = useMemo(() => data.risks ?? [], [data]);

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

  const riskItems = useMemo(() => {
    // Benchmark scores are per (category, risk, ageRange, prompt); breakdown shows one row per mid-level risk.
    const buckets = new Map<
      string,
      { category: string; risk: string; failing: number; adequate: number; exemplary: number }
    >();
    for (const s of scores) {
      const as = s.sums?.as ?? [0, 0, 0];
      const bucketKey = `${s.riskCategoryId}:${s.riskId}`;
      const cur = buckets.get(bucketKey) ?? {
        category: s.riskCategoryId,
        risk: s.riskId,
        failing: 0,
        adequate: 0,
        exemplary: 0,
      };
      cur.failing += as[0] ?? 0;
      cur.adequate += as[1] ?? 0;
      cur.exemplary += as[2] ?? 0;
      buckets.set(bucketKey, cur);
    }

    return Array.from(buckets.entries())
      .map(([bucketKey, agg]) => {
        const categoryName = categoryNameById.get(agg.category) || agg.category;
        const fromTax = riskNameByKey.get(`${agg.category}:${agg.risk}`);
        const riskDisplayName =
          fromTax && fromTax !== agg.risk ? fromTax : humanizeSlug(agg.risk);
        return {
          key: bucketKey,
          category: agg.category,
          categoryName,
          risk: agg.risk,
          riskName: riskDisplayName,
          failing: agg.failing,
          adequate: agg.adequate,
          exemplary: agg.exemplary,
          pct: safetyCompositePct(agg.failing, agg.adequate, agg.exemplary),
        };
      })
      .sort((a, b) => {
        const cat = a.categoryName.localeCompare(b.categoryName);
        if (cat !== 0) return cat;
        return a.riskName.localeCompare(b.riskName);
      });
  }, [scores, categoryNameById, riskNameByKey]);

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

  const overallRiskStats = useMemo(() => {
    let f = 0;
    let a = 0;
    let e = 0;
    for (const r of riskItems) {
      f += r.failing;
      a += r.adequate;
      e += r.exemplary;
    }
    return {
      failing: f,
      adequate: a,
      exemplary: e,
      pct: safetyCompositePct(f, a, e),
    };
  }, [riskItems]);

  const showToolbar = Boolean(onUploadZip || showScenariosCta);

  return (
    <div className="space-y-5">
      {showToolbar ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {onUploadZip && (
            <label className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)] cursor-pointer">
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
          Dataset: <span className="text-white/90">{uploadLabel}</span>
        </div>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 md:p-5">
        <h3 className="text-lg font-semibold text-white mb-1">Risk breakdown</h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          Overall score and every mid-level risk listed under its high-level category.{" "}
          {onSelectRisk ? (
            <span className="text-white/80">Click a row to filter scenarios below.</span>
          ) : null}
        </p>

        <div className="overflow-x-auto -mx-1 px-1">
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
                  <ScorePercentBar pct={overallRiskStats.pct} />
                </td>
                <td className="py-3 px-2 align-middle text-right text-xl font-bold tabular-nums text-white">
                  {overallRiskStats.pct.toFixed(0)}%
                </td>
              </tr>

              {groupedRiskItems.flatMap((group) => {
                const categoryTitle =
                  group.categoryLabel !== group.categoryId
                    ? group.categoryLabel
                    : humanizeSlug(group.categoryId);
                const n = group.items.length;
                return group.items.map((r, i) => {
                  const interactive = Boolean(onSelectRisk);
                  const rowClass = [
                    "transition-colors",
                    interactive ? "cursor-pointer hover:bg-white/[0.05]" : "",
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
                          className="align-top border-r border-[var(--border)]/50 py-2.5 pr-3 text-white font-medium leading-snug"
                        >
                          {categoryTitle}
                        </td>
                      ) : null}
                      <td className="py-2.5 px-1 text-center text-xs tabular-nums text-[var(--muted)] align-top">
                        {i + 1}
                      </td>
                      <td className="py-2.5 pr-3 align-top min-w-0">
                        <div className="font-medium text-white leading-snug break-words">{r.riskName}</div>
                        {onSelectRisk ? (
                          <div className="mt-1 text-[10px] text-[var(--accent)]">Scenarios →</div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-2 align-middle">
                        <ScorePercentBar pct={r.pct} />
                      </td>
                      <td className="py-2.5 px-2 align-middle text-right font-semibold tabular-nums text-white">
                        {r.pct.toFixed(0)}%
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
