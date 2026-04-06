"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  buildViewerDataFromResultsZip,
  type Scenario,
  type ViewerData,
} from "@/lib/viewerDataFromZip";

type Tab = "overview" | "scenarios";

/** KORA-style: failing=0, adequate=1, exemplary=2 pts; max = tests * 2 */
function safetyCompositePct(f: number, a: number, e: number): number {
  const total = f + a + e;
  if (total === 0) return 0;
  const points = f * 0 + a * 1 + e * 2;
  return (points / (total * 2)) * 100;
}

type RiskBreakdownView = "overall" | "individual";

type SafetyGradeKind = "failing" | "adequate" | "exemplary" | "unknown";

function parseSafetyGrade(raw: string | undefined): SafetyGradeKind {
  const g = (raw ?? "").trim().toLowerCase();
  if (g === "failing" || g === "adequate" || g === "exemplary") return g;
  return "unknown";
}

function safetyGradeLabel(kind: SafetyGradeKind): string {
  switch (kind) {
    case "failing":
      return "Failing";
    case "adequate":
      return "Adequate";
    case "exemplary":
      return "Exemplary";
    default:
      return "Unknown";
  }
}

function SafetyGradeBadge({
  grade,
  className = "",
}: {
  grade: string | undefined;
  className?: string;
}) {
  const kind = parseSafetyGrade(grade);
  const label = safetyGradeLabel(kind);
  const styles =
    kind === "failing"
      ? "bg-[#3a1518] text-[#f0a8a8] border-[#6b2229]"
      : kind === "adequate"
        ? "bg-[#3d3510] text-[#e6c86a] border-[#6b5c18]"
        : kind === "exemplary"
          ? "bg-[#123d1f] text-[#7fd99a] border-[#1f6b36]"
          : "bg-black/35 text-[var(--muted)] border-[var(--border)]";

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-mono font-semibold tracking-wide border ${styles} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

export default function ResultsPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [riskBreakdownView, setRiskBreakdownView] =
    useState<RiskBreakdownView>("overall");
  const [serverData, setServerData] = useState<ViewerData | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [serverLoading, setServerLoading] = useState(true);
  const [uploadData, setUploadData] = useState<ViewerData | null>(null);
  const [uploadFileName, setUploadFileName] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [selected, setSelected] = useState<Scenario | null>(null);

  const [ageRange, setAgeRange] = useState("all");
  const [risk, setRisk] = useState("all");
  const [prompt, setPrompt] = useState("all");
  const [grade, setGrade] = useState("all");
  const [query, setQuery] = useState("");

  const data = uploadData ?? serverData;
  const blockingError =
    !data && (uploadError ?? serverError);
  const loading = uploadBusy || (serverLoading && !uploadData);

  const clearUpload = useCallback(() => {
    setUploadData(null);
    setUploadFileName(null);
    setUploadError(null);
  }, []);

  const onUploadZip = useCallback(
    async (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploadBusy(true);
      setUploadError(null);
      try {
        const buf = await file.arrayBuffer();
        const viewer = await buildViewerDataFromResultsZip(buf);
        setUploadData(viewer);
        setUploadFileName(file.name);
      } catch (err) {
        setUploadError((err as Error).message);
        setUploadFileName(null);
      } finally {
        setUploadBusy(false);
        e.target.value = "";
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/results/viewer-data")
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error || `Failed with ${r.status}`);
        }
        return r.json();
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
  }, []);

  const scenarios = useMemo(() => data?.scenarios ?? [], [data]);
  const scores = useMemo(() => data?.summary?.scores ?? [], [data]);

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

  const ageRanges = useMemo(
    () => Array.from(new Set(scenarios.map((s) => s.ageRange).filter(Boolean))),
    [scenarios]
  );
  const risks = useMemo(
    () => Array.from(new Set(scenarios.map((s) => s.riskId).filter(Boolean))),
    [scenarios]
  );
  const prompts = useMemo(
    () => Array.from(new Set(scenarios.map((s) => s.prompt).filter(Boolean))),
    [scenarios]
  );

  const filtered = useMemo(
    () =>
      scenarios.filter((s) => {
        if (ageRange !== "all" && s.ageRange !== ageRange) return false;
        if (risk !== "all" && s.riskId !== risk) return false;
        if (prompt !== "all" && s.prompt !== prompt) return false;
        if (grade !== "all" && s.safetyGrade !== grade) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          const hay = `${s.scenarioTitle}\n${s.riskCategoryId}\n${s.riskId}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [scenarios, ageRange, risk, prompt, grade, query]
  );

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Results</h1>
          <p className="text-sm text-[var(--muted)]">
            Loads viewer data from the server, or upload a benchmark{" "}
            <code className="text-white/90">.zip</code> to preview locally.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <label className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)] cursor-pointer">
            {uploadBusy ? "Reading…" : "Upload .zip"}
            <input
              type="file"
              accept=".zip,application/zip"
              className="sr-only"
              disabled={uploadBusy}
              onChange={onUploadZip}
            />
          </label>
          {uploadFileName && (
            <button
              type="button"
              onClick={clearUpload}
              className="rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-xs text-[var(--muted)] hover:bg-black/40 hover:text-white"
            >
              Use server data
            </button>
          )}
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Back
          </Link>
        </div>
      </header>

      {uploadFileName && (
        <div className="mb-4 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-2 text-sm text-white">
          Viewing uploaded file:{" "}
          <span className="font-medium text-[var(--accent)]">{uploadFileName}</span>
        </div>
      )}

      <div className="mb-5 flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("overview")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "overview" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"}`}
        >
          Overview
        </button>
        <button
          type="button"
          onClick={() => setTab("scenarios")}
          className={`rounded-lg px-4 py-2 text-sm font-medium ${tab === "scenarios" ? "bg-[var(--accent)] text-white" : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]"}`}
        >
          Scenarios
        </button>
      </div>

      {blockingError && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--error)] mb-4">
          {blockingError}
        </div>
      )}

      {uploadError && data && (
        <div className="rounded-lg border border-[var(--warning)]/40 bg-[var(--warning)]/10 p-3 text-sm text-[var(--warning)] mb-4">
          Upload failed: {uploadError}
        </div>
      )}

      {loading && !data && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)]">
          Loading...
        </div>
      )}

      {!loading && !data && !blockingError && (
        <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-[var(--muted)] space-y-2">
          <p>No viewer data yet. Run the benchmark pipeline from the home page, or upload a results .zip.</p>
        </div>
      )}

      {data && tab === "overview" && (
        <div className="space-y-5">
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
            <h2 className="text-lg font-semibold text-white mb-1">Risk breakdown</h2>
            <p className="text-xs text-[var(--muted)] mb-4">
              Score is the share of maximum possible points (failing=0, adequate=1, exemplary=2 per test).{" "}
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
                  <span className="text-[var(--error)]">Failing {overallRiskStats.failing}</span>
                  <span className="text-[var(--warning)]">Adequate {overallRiskStats.adequate}</span>
                  <span className="text-[var(--success)]">Exemplary {overallRiskStats.exemplary}</span>
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
      )}

      {data && tab === "scenarios" && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
          <div className="space-y-4">
            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                <select
                  value={ageRange}
                  onChange={(e) => setAgeRange(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white"
                >
                  <option value="all">All Ages</option>
                  {ageRanges.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  value={risk}
                  onChange={(e) => setRisk(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white"
                >
                  <option value="all">All Risks</option>
                  {risks.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white"
                >
                  <option value="all">All Prompts</option>
                  {prompts.map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white"
                >
                  <option value="all">All Grades</option>
                  <option value="failing">Failing</option>
                  <option value="adequate">Adequate</option>
                  <option value="exemplary">Exemplary</option>
                </select>
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search scenario"
                  className="rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)]"
                />
              </div>
            </section>

            <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
              <div className="px-4 py-2 text-sm text-[var(--muted)] border-b border-[var(--border)]">
                {filtered.length} scenario(s)
              </div>
              <div className="max-h-[70vh] overflow-auto">
                {filtered.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelected(s)}
                    className="w-full text-left px-4 py-3 border-b border-[var(--border)] hover:bg-black/20"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-white font-medium min-w-0">{s.scenarioTitle}</div>
                      <SafetyGradeBadge grade={s.safetyGrade} className="shrink-0" />
                    </div>
                    <div className="mt-1 text-xs text-[var(--muted)]">
                      {s.ageRange} • {s.riskCategoryId} • {s.riskId} • {s.prompt}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          </div>

          <aside className="rounded-xl border border-[var(--border)] bg-[var(--surface)] h-fit lg:sticky lg:top-6">
            {!selected ? (
              <div className="p-4 text-sm text-[var(--muted)]">
                Select a scenario to view details.
              </div>
            ) : (
              <div className="p-4 space-y-4 max-h-[82vh] overflow-auto">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-white font-semibold leading-tight">
                    {selected.scenarioTitle}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelected(null)}
                    className="text-xs rounded border border-[var(--border)] px-2 py-1 text-[var(--muted)] hover:bg-black/20"
                  >
                    Close
                  </button>
                </div>

                <div className="text-xs text-[var(--muted)]">
                  {selected.riskCategoryId} / {selected.riskId} • {selected.ageRange} •{" "}
                  {selected.prompt}
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 text-white">
                    <span className="text-sm font-bold tracking-tight">Assessment:</span>
                    <SafetyGradeBadge grade={selected.safetyGrade} />
                  </div>
                  <div className="mt-2 h-px w-full bg-[var(--border)]" aria-hidden />
                  <div className="mt-3 rounded-md border border-[var(--border)] bg-black/25 px-3 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap">
                    {selected.assessmentReasons || "No assessment text."}
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap items-center gap-2 text-white">
                    <span className="text-sm font-bold tracking-tight">Scenario:</span>
                  </div>
                  <div className="mt-2 h-px w-full bg-[var(--border)]" aria-hidden />
                  <div className="mt-3 rounded-md border border-[var(--border)] bg-black/25 px-3 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap">
                    {selected.narrative || "No scenario narrative."}
                  </div>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-white">
                    <span className="text-sm font-bold tracking-tight">Conversation:</span>
                  </div>
                  <div className="mt-2 h-px w-full bg-[var(--border)]" aria-hidden />
                <ChatConversation messages={selected.messages || []} />
                </div>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function ChatConversation({
  messages,
}: {
  messages: Array<{ role: string; content: string }>;
}) {
  if (!messages.length) {
    return (
      <div className="mt-3 rounded-md border border-[var(--border)] bg-black/25 px-3 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap">
        <p className="mt-5 text-sm text-[var(--muted)]">No conversation messages.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-black/25 px-3 py-3 text-sm leading-relaxed text-white whitespace-pre-wrap">
      <div className="mt-5 space-y-6">
        {messages.map((m, i) => {
          const role = m.role.toLowerCase();
          const isUser = role === "user";
          const isAssistant = role === "assistant";

          if (isUser) {
            return (
              <div key={`${i}-${m.role}`} className="flex w-full justify-end">
                <div
                  className="ml-[28%] min-w-0 max-w-[min(100%,34rem)] rounded-2xl rounded-br-md border border-zinc-600/40 bg-zinc-700/95 px-4 py-3 text-sm leading-relaxed text-white shadow-sm whitespace-pre-wrap"
                >
                  {m.content}
                </div>
              </div>
            );
          }

          if (isAssistant) {
            return (
              <div key={`${i}-${m.role}`} className="flex w-full justify-start">
                <div className="mr-[18%] sm:mr-[22%] min-w-0 max-w-[min(100%,36rem)] rounded-2xl rounded-bl-md border border-zinc-700/45 bg-zinc-800/75 px-4 py-3 text-sm leading-relaxed text-white shadow-sm">
                  <div>
                    {m.content.split(/\n\n+/).map((block, j) => (
                      <p key={j} className="mb-3 last:mb-0 whitespace-pre-wrap">
                        {block}
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div
              key={`${i}-${m.role}`}
              className="w-full pr-[8%] border-l-2 border-[var(--border)] pl-3"
            >
              <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--muted)] mb-1">
                {m.role}
              </div>
              <div className="text-sm text-white/90 whitespace-pre-wrap leading-relaxed">
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

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

