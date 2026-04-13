"use client";

import { useEffect, useState } from "react";
import { ResultsOverview } from "@/components/ResultsOverview";
import { ViewerDataExplorer } from "@/components/ViewerDataExplorer";
import type { ViewerData } from "@/lib/viewerDataFromZip";

export default function TestResultsPage() {
  const [data, setData] = useState<ViewerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/public/viewer-data")
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(
            typeof j.error === "string" ? j.error : `Failed with ${r.status}`
          );
        }
        return r.json();
      })
      .then((j: ViewerData) => {
        if (!cancelled) setData(j);
      })
      .catch((e) => {
        if (!cancelled) setError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const blockingError = !data && error;

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-8 max-w-3xl">
        <h1 className="text-2xl font-bold text-white md:text-3xl">Test results</h1>
        <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">
          Same dataset as the static{" "}
          <code className="text-white/90">benchmark/results-viewer</code>: archived run summary
          and per-scenario outcomes from{" "}
          <code className="text-white/90">results-viewer/data/viewer-data.json</code>. Regenerate
          with{" "}
          <code className="text-white/90 whitespace-nowrap">
            yarn results-viewer:data
          </code>{" "}
          from the benchmark directory after archiving a run.
        </p>
        {data?.generatedAt ? (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Generated <span className="text-white/80">{data.generatedAt}</span>
          </p>
        ) : null}
      </header>

      {blockingError && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--error)] mb-6">
          {blockingError}
        </div>
      )}

      {loading && !data && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)]">
          Loading viewer data…
        </div>
      )}

      {data && (
        <div className="space-y-10">
          <ResultsOverview
            data={data}
            scenariosHref="/test-results#scenarios"
            showScenariosCta={false}
          />
          <section id="scenarios" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-white mb-4">Scenarios</h2>
            <ViewerDataExplorer data={data} />
          </section>
        </div>
      )}
    </div>
  );
}
