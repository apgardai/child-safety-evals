"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
type PromptViewMode = "assistant" | "child-aware";

type GradeCounts = { failing: number; adequate: number; exemplary: number };

type RiskBreakdownItem = {
  key: string;
  category: string;
  categoryName: string;
  risk: string;
  riskName: string;
  default: GradeCounts;
  child: GradeCounts;
  defaultPct: number;
  childPct: number;
};

function emptyCounts(): GradeCounts {
  return { failing: 0, adequate: 0, exemplary: 0 };
}

function addCounts(target: GradeCounts, as: number[]) {
  target.failing += as[0] ?? 0;
  target.adequate += as[1] ?? 0;
  target.exemplary += as[2] ?? 0;
}

function ScorePercentBar({
  pct,
  variant = "default",
}: {
  pct: number;
  variant?: "default" | "child";
}) {
  const w = Math.max(0, Math.min(100, pct));
  const label = variant === "child" ? "Child-aware" : "Assistant (default)";
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

function MixScoreBars({
  mode,
  defaultPct,
  childPct,
}: {
  mode: PromptViewMode;
  defaultPct: number;
  childPct: number;
}) {
  if (mode === "assistant") {
    return <ScorePercentBar pct={defaultPct} variant="default" />;
  }
  return (
    <div className="space-y-1.5">
      <ScorePercentBar pct={defaultPct} variant="default" />
      <ScorePercentBar pct={childPct} variant="child" />
    </div>
  );
}

function MixScoreValues({
  mode,
  defaultPct,
  childPct,
  overall = false,
}: {
  mode: PromptViewMode;
  defaultPct: number;
  childPct: number;
  overall?: boolean;
}) {
  if (mode === "assistant") {
    return (
      <span
        className={
          overall
            ? "text-xl font-bold tabular-nums text-[var(--text)]"
            : "font-semibold tabular-nums text-[var(--text)]"
        }
      >
        {defaultPct.toFixed(0)}%
      </span>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1 tabular-nums">
      <span
        className={
          overall
            ? "text-lg font-bold text-[var(--text)]"
            : "font-semibold text-[var(--text)]"
        }
      >
        {defaultPct.toFixed(0)}%
      </span>
      <span className={
          overall
            ? "text-lg font-bold text-[var(--muted)]"
            : "font-semibold text-[var(--muted)]"
        }>{childPct.toFixed(0)}%</span>
    </div>
  );
}

function PromptViewToggle({
  mode,
  onChange,
}: {
  mode: PromptViewMode;
  onChange: (mode: PromptViewMode) => void;
}) {
  return (
    <div
      className="inline-flex rounded-lg border border-[var(--border)] bg-[var(--surface)] p-0.5 text-xs font-medium"
      role="group"
      aria-label="Prompt variant view"
    >
      {(
        [
          ["assistant", "Assistant"],
          ["child-aware", "Child-aware"],
        ] as const
      ).map(([value, label]) => {
        const active = mode === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            className={[
              "rounded-md px-3 py-1.5 transition-colors",
              active
                ? "bg-[var(--accent)] text-white"
                : "text-[var(--muted)] hover:text-[var(--text)]",
            ].join(" ")}
            onClick={() => onChange(value)}
          >
            {label}
          </button>
        );
      })}
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
  const hasChildScores = useMemo(
    () =>
      scores.some((s) => (s.prompt ?? "default") === "child") ||
      (data.summary?.prompts ?? []).includes("child"),
    [scores, data.summary?.prompts]
  );
  const [promptView, setPromptView] = useState<PromptViewMode>("assistant");

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

  const riskItems = useMemo((): RiskBreakdownItem[] => {
    const buckets = new Map<
      string,
      {
        category: string;
        risk: string;
        default: GradeCounts;
        child: GradeCounts;
      }
    >();

    for (const s of scores) {
      const as = s.sums?.as ?? [0, 0, 0];
      const bucketKey = `${s.riskCategoryId}:${s.riskId}`;
      const cur = buckets.get(bucketKey) ?? {
        category: s.riskCategoryId,
        risk: s.riskId,
        default: emptyCounts(),
        child: emptyCounts(),
      };
      const prompt = (s.prompt ?? "default") === "child" ? "child" : "default";
      addCounts(cur[prompt], as);
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
          default: agg.default,
          child: agg.child,
          defaultPct: safetyCompositePct(
            agg.default.failing,
            agg.default.adequate,
            agg.default.exemplary
          ),
          childPct: safetyCompositePct(
            agg.child.failing,
            agg.child.adequate,
            agg.child.exemplary
          ),
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
    let defaultCounts = emptyCounts();
    let childCounts = emptyCounts();
    for (const r of riskItems) {
      addCounts(defaultCounts, [r.default.failing, r.default.adequate, r.default.exemplary]);
      addCounts(childCounts, [r.child.failing, r.child.adequate, r.child.exemplary]);
    }
    return {
      default: defaultCounts,
      child: childCounts,
      defaultPct: safetyCompositePct(
        defaultCounts.failing,
        defaultCounts.adequate,
        defaultCounts.exemplary
      ),
      childPct: safetyCompositePct(
        childCounts.failing,
        childCounts.adequate,
        childCounts.exemplary
      ),
    };
  }, [riskItems]);

  const activeView: PromptViewMode = hasChildScores ? promptView : "assistant";

  const showToolbar = Boolean(onUploadZip || showScenariosCta);

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

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-semibold text-[var(--text)]">Risk breakdown</h2>
          {hasChildScores ? (
            <PromptViewToggle mode={activeView} onChange={setPromptView} />
          ) : null}
        </div>
        <p className="text-xs text-[var(--muted)] mb-4">
          Overall score and every mid-level risk listed under its high-level category.{" "}
          {onSelectRisk ? (
            <span className="text-[var(--muted)]">Click a row to filter scenarios below.</span>
          ) : null}
          {hasChildScores && activeView === "child-aware" ? (
            <span className="block mt-1 text-[var(--muted)]">
              Top bar: Assistant (default - model doesn't know it is talking to a child). <br /> Bottom bar: Child-aware (model knows it is talking to a child).
            </span>
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
                  Mix
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
                  All groups combined
                </td>
                <td className="py-3 px-2 align-middle">
                  <MixScoreBars
                    mode={activeView}
                    defaultPct={overallRiskStats.defaultPct}
                    childPct={overallRiskStats.childPct}
                  />
                </td>
                <td className="py-3 px-2 align-middle text-right">
                  <MixScoreValues
                    mode={activeView}
                    defaultPct={overallRiskStats.defaultPct}
                    childPct={overallRiskStats.childPct}
                    overall
                  />
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
                        <div className="font-medium text-[var(--text)] leading-snug break-words">{r.riskName}</div>
                        {onSelectRisk ? (
                          <div className="mt-1 text-[10px] text-[var(--accent)]">Scenarios →</div>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-2 align-middle">
                        <MixScoreBars
                          mode={activeView}
                          defaultPct={r.defaultPct}
                          childPct={r.childPct}
                        />
                      </td>
                      <td className="py-2.5 px-2 align-middle text-right">
                        <MixScoreValues
                          mode={activeView}
                          defaultPct={r.defaultPct}
                          childPct={r.childPct}
                        />
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
