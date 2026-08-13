"use client";

import { useEffect, useMemo, useState } from "react";
import type { BenchmarkId } from "data/benchmarks";
import { getBenchmarkDefinition } from "data/benchmarks";
import requestsClient from "lib/requests-client";
import { humanizeSlug } from "lib/humanizeSlug";

export type BenchmarkScenarioPreviewRow = {
  index: number;
  scenario_id: string;
  short_title: string;
  risk_category_id: string;
  risk_id: string;
  age_range: string;
  motivation: string;
  risk_signal_type: string;
  child_age: number;
  child_gender: string;
  social_context: string;
  first_user_message_preview: string;
};

type PreviewResponse = {
  benchmark?: string | null;
  label?: string | null;
  description?: string | null;
  scenario_count: number;
  test_count: number;
  prompt_variants: string[];
  scenarios: BenchmarkScenarioPreviewRow[];
};

function formatAgeRange(value: string): string {
  const s = value.trim();
  if (!s) return "—";
  return s.replace(/to/gi, "–").replace(/(\d+)/g, "$1");
}

type Props = {
  prompts: string[];
  benchmarkId: BenchmarkId;
  /** When true, omit outer card chrome (for nesting inside another panel). */
  embedded?: boolean;
};

export default function BenchmarkScenariosPreview({
  prompts,
  benchmarkId,
  embedded = false,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PreviewResponse | null>(null);

  const promptsKey = useMemo(
    () => (prompts.length ? [...prompts].sort().join(",") : "default"),
    [prompts]
  );

  const fallbackLabel = getBenchmarkDefinition(benchmarkId)?.label ?? benchmarkId;

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      setExpanded(false);
      try {
        const params = new URLSearchParams({ benchmark: benchmarkId });
        if (prompts.length) {
          params.set("prompts", prompts.join(","));
        }
        const r = await requestsClient.get<PreviewResponse>(
          `/api/benchmark/scenarios-preview?${params.toString()}`,
          { validateStatus: () => true }
        );
        if (cancelled) return;
        if (r.status < 200 || r.status >= 300) {
          const detail =
            (r.data as { detail?: string } | undefined)?.detail ||
            (r.data as { error?: string } | undefined)?.error ||
            `Could not load scenario preview (${r.status}).`;
          setError(detail);
          setData(null);
          return;
        }
        setData(r.data ?? null);
      } catch (e) {
        if (!cancelled) {
          setError((e as Error).message);
          setData(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [benchmarkId, promptsKey, prompts]);

  const rootClass = embedded
    ? "mt-3"
    : "mt-6 rounded-xl border border-[var(--border)] bg-[var(--gray-100)] p-4 md:p-5";

  const label = data?.label?.trim() || fallbackLabel;
  const description = data?.description?.trim() || getBenchmarkDefinition(benchmarkId)?.description;

  return (
    <section className={rootClass}>
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            disabled={loading || !!error || !data?.scenarios.length}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--text)] hover:bg-[var(--gray-100)] disabled:opacity-50"
          >
            {expanded ? "Hide table" : "Preview Scenarios"}
          </button>
          {!embedded && (
            <h3 className="text-sm font-semibold text-[var(--text)]">{label}</h3>
          )}
        </div>

        {description ? (
          <p className="text-xs text-[var(--muted)] leading-relaxed">{description}</p>
        ) : null}

        {!loading && !error && data ? (
          <p className="text-xs text-[var(--muted)]">
            <span className="font-medium text-[var(--text)]">{data.scenario_count}</span> scenarios
            {" · "}
            <span className="font-medium text-[var(--text)]">{data.test_count}</span> tests with
            selected prompt variants
          </p>
        ) : null}
      </div>

      {loading && (
        <p className="mt-3 text-xs text-[var(--muted)]">Loading scenarios…</p>
      )}
      {error && (
        <p className="mt-3 text-xs text-[var(--error)]">{error}</p>
      )}

      {expanded && data && data.scenarios.length > 0 && (
        <>
          {data.scenario_count > data.scenarios.length && (
            <p className="mt-3 text-xs text-[var(--muted)]">
              Showing {data.scenarios.length} randomly selected of {data.scenario_count}{" "}
              scenarios.
            </p>
          )}
        <div className="mt-2 max-h-[28rem] overflow-auto rounded-lg border border-[var(--border)]">
          <table className="w-full min-w-[56rem] border-collapse text-left text-xs">
            <thead className="sticky top-0 z-10 bg-[var(--surface)] text-[var(--muted)]">
              <tr>
                <th className="px-2 py-2 font-medium">#</th>
                <th className="px-2 py-2 font-medium">Title</th>
                <th className="px-2 py-2 font-medium">Risk category</th>
                <th className="px-2 py-2 font-medium">Risk</th>
                <th className="px-2 py-2 font-medium">Age band</th>
                <th className="px-2 py-2 font-medium">Child</th>
                <th className="px-2 py-2 font-medium">Motivation</th>
                <th className="px-2 py-2 font-medium">Signal</th>
                <th className="px-2 py-2 font-medium">Context</th>
                <th className="px-2 py-2 font-medium min-w-[14rem]">First user message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-[var(--text)]/90">
              {data.scenarios.map((row) => (
                <tr key={row.scenario_id} className="align-top hover:bg-[var(--gray-100)]">
                  <td className="px-2 py-2 text-[var(--muted)]">{row.index}</td>
                  <td className="px-2 py-2 max-w-[10rem]">
                    <span className="font-medium text-[var(--text)]">{row.short_title}</span>
                  </td>
                  <td className="px-2 py-2">{humanizeSlug(row.risk_category_id)}</td>
                  <td className="px-2 py-2">{humanizeSlug(row.risk_id)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{formatAgeRange(row.age_range)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">
                    {row.child_age ? `${row.child_age}y` : "—"}
                    {row.child_gender ? ` · ${humanizeSlug(row.child_gender)}` : ""}
                  </td>
                  <td className="px-2 py-2 max-w-[9rem]">{row.motivation || "—"}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{humanizeSlug(row.risk_signal_type)}</td>
                  <td className="px-2 py-2 whitespace-nowrap">{humanizeSlug(row.social_context)}</td>
                  <td className="px-2 py-2 text-[var(--muted)] leading-relaxed" title={row.first_user_message_preview}>
                    {row.first_user_message_preview || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}
    </section>
  );
}
