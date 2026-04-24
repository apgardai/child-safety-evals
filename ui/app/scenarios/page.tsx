"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ViewerDataExplorer } from "components/ViewerDataExplorer";
import requestsClient from "lib/requests-client";
import type { ViewerData } from "lib/viewerDataFromZip";

export default function ScenariosPage() {
  const [serverData, setServerData] = useState<ViewerData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [selectedZipFile, setSelectedZipFile] = useState<string | null>(null);

  const data = serverData;
  const blockingError = !data && serverError;
  const loading = !data && serverLoading;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const file = params.get("file")?.trim();
    setSelectedZipFile(file || null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const q = selectedZipFile
      ? `?file=${encodeURIComponent(selectedZipFile)}`
      : "";
    requestsClient
      .get<ViewerData>(`/api/scenarios/viewer-data${q}`, { validateStatus: () => true })
      .then((r) => {
        if (r.status < 200 || r.status >= 300) {
          const body = r.data as unknown;
          const errMsg =
            typeof body === "object" &&
            body !== null &&
            "error" in body &&
            typeof (body as { error?: string }).error === "string"
              ? (body as { error: string }).error
              : `Failed with ${r.status}`;
          throw new Error(errMsg);
        }
        return r.data;
      })
      .then((j: ViewerData) => {
        if (!cancelled) setServerData(j);
      })
      .catch((e) => {
        if (!cancelled) setServerError((e as Error).message);
      })
      .finally(() => {
        if (!cancelled) setServerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedZipFile]);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Scenarios</h1>
          <p className="text-sm text-[var(--muted)]">
            Loads the latest <span className="text-white/90">results zip file</span> from the
            benchmark data directory. Upload a different{" "}
            <span className="text-white/90">results zip file</span> from the benchmark page to
            update the scenarios.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Link
            href="/benchmark"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Back
          </Link>
        </div>
      </header>

      {selectedZipFile && (
        <div className="mb-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-white">
          Viewing selected archive:{" "}
          <span className="font-medium text-[var(--accent)]">{selectedZipFile}</span>
        </div>
      )}

      {blockingError && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--error)] mb-4">
          {blockingError}
        </div>
      )}

      {loading && !data && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)]">
          Loading...
        </div>
      )}

      {!loading && !data && !blockingError && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)] space-y-2">
          <p>
            No results archive found under{" "}
            <code className="text-white/90">benchmark/data/results-*.zip</code> and no{" "}
            <code className="text-white/90">viewer-data.json</code>. Run a benchmark from the
            benchmark page, or upload a results <code className="text-white/90">.zip</code>.
          </p>
        </div>
      )}

      {data && <ViewerDataExplorer data={data} />}
    </div>
  );
}
