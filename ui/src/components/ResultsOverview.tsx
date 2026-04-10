"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ViewerData } from "@/lib/viewerDataFromZip";

/** KORA-style: failing=0, adequate=1, exemplary=2 pts; max = tests * 2 */
function safetyCompositePct(f: number, a: number, e: number): number {
  const total = f + a + e;
  if (total === 0) return 0;
  const points = f * 0 + a * 1 + e * 2;
  return (points / (total * 2)) * 100;
}

type RiskBreakdownView = "overall" | "individual";

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-[var(--border)] bg-black/20 p-3">
      <div className="text-[10px] uppercase tracking-wide text-[var(--muted)]">
        {label}
      </div>
      <div className="text-sm text-white mt-1 break-all">{value}</div>
    </div>
  );
}

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
}: {
  data: ViewerData;
  /** Link to scenarios tab for this dataset */
  scenariosHref?: string;
  uploadBusy?: boolean;
  uploadLabel?: string;
  onUploadZip?: (file: File) => void;
}) {
  const [riskBreakdownView, setRiskBreakdownView] =
    useState<RiskBreakdownView>("overall");

  const scores = useMemo(() => data.summary?.scores ?? [], [data]);
  const scenarios = useMemo(() => data.scenarios ?? [], [data]);

  const riskItems = useMemo(
    () =>
      scores.map((s) => {
        const as = s.sums?.as ?? [0, 0, 0];
        const failing = as[0] ?? 0;
        const adequate = as[1] ?? 0;
        const exemplary = as[2] ?? 0;
        return {
          key: `${s.riskCategoryId}:${s.riskId}`,
          category: s.riskCategoryId,
          risk: s.riskId,
          failing,
          adequate,
          exemplary,
          pct: safetyCompositePct(failing, adequate, exemplary),
        };
      }),
    [scores]
  );

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

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-white">Run overview</h2>
        <div className="flex flex-wrap items-center gap-2">
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
          <Link
            href={scenariosHref}
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            View scenarios
          </Link>
        </div>
      </div>
      {uploadLabel && (
        <div className="text-xs text-[var(--muted)]">
          Dataset: <span className="text-white/90">{uploadLabel}</span>
        </div>
      )}

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
          <InfoCard label="Target" value={data.summary?.target || "-"} />
          <InfoCard label="Judge" value={data.summary?.judge || "-"} />
          <InfoCard label="User" value={data.summary?.user || "-"} />
          <InfoCard
            label="Prompts"
            value={(data.summary?.prompts || []).join(", ") || "-"}
          />
          <InfoCard label="Risk groups" value={String(scores.length)} />
          <InfoCard label="Scenarios" value={String(scenarios.length)} />
        </div>
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h3 className="text-lg font-semibold text-white mb-1">Risk breakdown</h3>
        <p className="text-xs text-[var(--muted)] mb-4">
          Score is the share of maximum possible points (failing=0, adequate=1,
          exemplary=2 per test).{" "}
          <span className="text-white/80">
            Click the highlighted bar to switch between overall and per-risk views.
          </span>
        </p>

        {riskBreakdownView === "overall" ? (
          <button
            type="button"
            onClick={() => setRiskBreakdownView("individual")}
            className="w-full rounded-xl border border-[var(--accent)]/40 bg-black/25 p-4 text-left transition hover:bg-black/35 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/50"
          >
            <div className="flex items-end justify-between gap-3 mb-2">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--muted)]">
                  Overall safety score
                </div>
                <div className="text-4xl font-bold text-white tabular-nums">
                  {overallRiskStats.pct.toFixed(0)}%
                </div>
              </div>
              <span className="text-xs text-[var(--accent)] shrink-0">
                Show per-risk →
              </span>
            </div>
            <ScorePercentBar pct={overallRiskStats.pct} />
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-[var(--muted)]">
              <span className="text-[var(--error)]">
                Failing {overallRiskStats.failing}
              </span>
              <span className="text-[var(--warning)]">
                Adequate {overallRiskStats.adequate}
              </span>
              <span className="text-[var(--success)]">
                Exemplary {overallRiskStats.exemplary}
              </span>
            </div>
          </button>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => setRiskBreakdownView("overall")}
              className="w-full rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2 text-left text-sm text-[var(--muted)] hover:bg-black/30 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/40"
            >
              ← Back to overall ({overallRiskStats.pct.toFixed(0)}%)
            </button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {riskItems.map((r) => (
                <div
                  key={r.key}
                  className="rounded-lg border border-[var(--border)] bg-black/20 p-3"
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {r.risk}
                      </div>
                      <div className="text-[11px] text-[var(--muted)] truncate">
                        {r.category}
                      </div>
                    </div>
                    <div className="text-lg font-bold text-white tabular-nums shrink-0">
                      {r.pct.toFixed(0)}%
                    </div>
                  </div>
                  <ScorePercentBar pct={r.pct} />
                  <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-[var(--muted)]">
                    <span className="text-[var(--error)]">F {r.failing}</span>
                    <span className="text-[var(--warning)]">A {r.adequate}</span>
                    <span className="text-[var(--success)]">E {r.exemplary}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
