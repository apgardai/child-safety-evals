"use client";

import { useEffect, useMemo, useState } from "react";
import { ResultsOverview } from "components/ResultsOverview";
import { TestResultsModelOverview } from "components/TestResultsModelOverview";
import { ViewerDataExplorer } from "components/ViewerDataExplorer";
import { humanizeSlug } from "lib/humanizeSlug";
import type { ViewerData } from "lib/viewerDataFromZip";

export default function TestResultsPage() {
  const [data, setData] = useState<ViewerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState<{
    riskCategoryId: string;
    riskId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/benchmark/testResults/viewer-data.json")
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

  const selectedRiskDescription = useMemo(() => {
    if (!selectedRisk || !data) return null;
    const cat = data.risks?.find((c) => c.id === selectedRisk.riskCategoryId);
    const catLabel =
      cat?.name?.trim() && cat.name !== selectedRisk.riskCategoryId
        ? cat.name.trim()
        : humanizeSlug(selectedRisk.riskCategoryId);
    const riskObj = cat?.risks?.find((r) => r.id === selectedRisk.riskId);
    const riskLabel =
      riskObj?.name?.trim() && riskObj.name !== selectedRisk.riskId
        ? riskObj.name.trim()
        : humanizeSlug(selectedRisk.riskId);
    return `${catLabel} · ${riskLabel}`;
  }, [data, selectedRisk]);

  function handleSelectRisk(risk: { riskCategoryId: string; riskId: string }) {
    setSelectedRisk(risk);
    const el = document.getElementById("scenarios");
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
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
          <TestResultsModelOverview data={data} />
          <ResultsOverview
            data={data}
            scenariosHref="/test-results#scenarios"
            showScenariosCta={false}
            onSelectRisk={handleSelectRisk}
          />
          <section id="scenarios" className="scroll-mt-24">
            <h2 className="text-lg font-semibold text-white mb-4">Scenarios</h2>
            {selectedRisk && selectedRiskDescription ? (
              <p className="mb-3 text-xs text-[var(--muted)]">
                Filtered from risk breakdown:{" "}
                <span className="text-white/90">{selectedRiskDescription}</span>
              </p>
            ) : null}
            <ViewerDataExplorer data={data} selectedRisk={selectedRisk} />
          </section>
        </div>
      )}
    </div>
  );
}
