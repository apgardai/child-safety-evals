"use client";

import { useEffect, useMemo, useState } from "react";

import { ResultsOverview } from "components/ResultsOverview";
import { TestResultsModelOverview } from "components/TestResultsModelOverview";
import { ViewerDataExplorer } from "components/ViewerDataExplorer";
import { humanizeSlug } from "lib/humanizeSlug";
import requestsClient from "lib/requests-client";
import { viewerDataRequestForModelId } from "lib/viewerDataApi";
import type { ViewerData } from "lib/viewerDataFromZip";

type ModelBenchmarkResultsProps = {
  modelId: string;
  scenariosHref: string;
};

export function ModelBenchmarkResults({ modelId, scenariosHref }: ModelBenchmarkResultsProps) {
  const [data, setData] = useState<ViewerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRisk, setSelectedRisk] = useState<{
    riskCategoryId: string;
    riskId: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    setSelectedRisk(null);

    const { url, params } = viewerDataRequestForModelId(modelId);
    void requestsClient
      .get<ViewerData>(url, { params, validateStatus: () => true })
      .then((res) => {
        if (cancelled) return;
        if (res.status >= 400) {
          const detail =
            typeof res.data === "object" &&
            res.data !== null &&
            "detail" in res.data &&
            typeof (res.data as { detail?: unknown }).detail === "string"
              ? (res.data as { detail: string }).detail
              : `Failed with ${res.status}`;
          throw new Error(detail);
        }
        setData(res.data);
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
  }, [modelId]);

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

  if (blockingError) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--error)]">
        {blockingError}
      </div>
    );
  }

  if (loading && !data) {
    return (
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)]">
        Loading benchmark results…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-10">
      {data.inProgress ? (
        <div
          className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 px-4 py-3 text-sm text-[var(--text)]"
          role="status"
        >
          Benchmark in progress — showing completed tests from the live run. Refresh to see
          new results.
        </div>
      ) : null}
      <TestResultsModelOverview data={data} />
      <ResultsOverview
        data={data}
        scenariosHref={scenariosHref}
        showScenariosCta={false}
        onSelectRisk={handleSelectRisk}
      />
      <section id="scenarios" className="scroll-mt-24">
        <h2 className="text-2xl font-semibold text-[var(--text)] mb-4">Scenarios</h2>
        {selectedRisk && selectedRiskDescription ? (
          <p className="mb-3 text-xs text-[var(--muted)]">
            Filtered from risk breakdown:{" "}
            <span className="text-[var(--text)]/90">{selectedRiskDescription}</span>
          </p>
        ) : null}
        <ViewerDataExplorer data={data} selectedRisk={selectedRisk} />
      </section>
    </div>
  );
}
