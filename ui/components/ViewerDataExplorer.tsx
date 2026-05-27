"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { humanizeSlug } from "lib/humanizeSlug";
import type { Scenario, ViewerData } from "lib/viewerDataFromZip";

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
          : "bg-[var(--gray-100)] text-[var(--muted)] border-[var(--border)]";

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-mono font-semibold tracking-wide border ${styles} ${className}`.trim()}
    >
      {label}
    </span>
  );
}

function formatAgeRangeLabel(ageRange: string | undefined): string {
  const raw = (ageRange ?? "").trim();
  if (!raw) return "—";
  const m = /^(\d+)to(\d+)$/i.exec(raw.replace(/\s/g, ""));
  if (m) return `Age ${m[1]} to ${m[2]}`;
  return raw;
}

function formatPromptVariantLabel(prompt: string | undefined): string {
  const p = (prompt ?? "").trim().toLowerCase();
  if (p === "child") return "Child-aware";
  if (p === "default") return "Assistant";
  if (!p) return "—";
  return p.charAt(0).toUpperCase() + p.slice(1);
}

function scenarioRiskCell(s: Scenario): { primary: string; secondary?: string } {
  const risk =
    s.riskName?.trim() && s.riskName !== s.riskId
      ? s.riskName.trim()
      : humanizeSlug(s.riskId) || "—";
  const cat =
    s.riskCategoryName?.trim() && s.riskCategoryName !== s.riskCategoryId
      ? s.riskCategoryName.trim()
      : humanizeSlug(s.riskCategoryId);
  if (!cat || cat === risk) return { primary: risk };
  return { primary: risk, secondary: cat };
}

function inferModelMaker(slug: string | undefined): string {
  const s = (slug ?? "").trim().toLowerCase();
  if (!s) return "—";
  if (s.startsWith("custom-")) return "Custom";
  if (s.includes("claude")) return "Anthropic";
  if (s.includes("gpt") || s.includes("openai") || /^o\d/i.test(s)) return "OpenAI";
  if (s.includes("gemini") || s.includes("google")) return "Google";
  if (s.includes("deepseek")) return "DeepSeek";
  if (s.includes("llama") || s.includes("meta-")) return "Meta";
  if (s.includes("grok")) return "xAI";
  if (s.includes("mistral") || s.includes("ministral")) return "Mistral";
  if (s.includes("glm")) return "Z.ai";
  if (s.includes("kimi")) return "Moonshot";
  return "Unknown provider";
}

function formatTargetModelLabel(slug: string | undefined): string {
  const s = (slug ?? "").trim();
  if (!s) return "—";
  return s
    .split(/[:]+/)
    .map((segment) =>
      segment
        .split(/[-_\s.]+/)
        .filter(Boolean)
        .map((part) => {
          const lower = part.toLowerCase();
          if (lower === "gpt") return "GPT";
          if (lower === "api") return "API";
          if (/^v?\d+(\.\d+)*[a-z]?$/i.test(part)) return part.toUpperCase();
          return lower.charAt(0).toUpperCase() + lower.slice(1);
        })
        .join(" ")
    )
    .join(" · ");
}

function AiMark() {
  return (
    <span
      className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded border border-white/15 bg-white/[0.07] px-1 text-[9px] font-bold tracking-tight text-[var(--text)]/90"
      aria-hidden
    >
      AI
    </span>
  );
}

function ScenarioDetailMeta({
  scenario,
  targetModelSlug,
}: {
  scenario: Scenario;
  targetModelSlug: string | undefined;
}) {
  const riskCategory =
    scenario.riskCategoryName?.trim() ||
    humanizeSlug(scenario.riskCategoryId) ||
    "—";
  const riskLabel =
    scenario.riskName?.trim() ||
    humanizeSlug(scenario.riskId) ||
    "—";
  const maker = inferModelMaker(targetModelSlug);
  const modelLabel = formatTargetModelLabel(targetModelSlug);

  const fields: { label: string; value: ReactNode }[] = [
    { label: "Risk category", value: riskCategory },
    { label: "Model maker", value: maker },
    { label: "Age range", value: formatAgeRangeLabel(scenario.ageRange) },
    { label: "Risk", value: riskLabel },
    {
      label: "Model",
      value: modelLabel,
    },
    { label: "Prompt", value: formatPromptVariantLabel(scenario.prompt) },
  ];

  return (
    <div className="grid grid-cols-3 gap-x-3 gap-y-5 sm:gap-x-5">
      {fields.map((f) => (
        <div key={f.label} className="min-w-0">
          <div className="text-xs text-[var(--muted)]">{f.label}</div>
          <div className="mt-1 min-w-0">
            {f.label === "Model maker" && maker !== "—" ? (
              <div className="flex items-center gap-2">
                <AiMark />
                <span className="text-sm font-semibold text-[var(--text)] break-words">
                  {f.value}
                </span>
              </div>
            ) : (
              <span className="text-sm font-semibold text-[var(--text)] break-words">
                {f.value}
              </span>
            )}
          </div>
        </div>
      ))}
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
      <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--gray-100)] px-3 py-3 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">
        <p className="mt-5 text-sm text-[var(--muted)]">No conversation messages.</p>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--gray-100)] px-3 py-3 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">
      <div className="mt-5 space-y-6">
        {messages.map((m, i) => {
          const role = m.role.toLowerCase();
          const isUser = role === "user";
          const isAssistant = role === "assistant";

          if (isUser) {
            return (
              <div key={`${i}-${m.role}`} className="flex w-full justify-end">
                <div
                  className="ml-[28%] min-w-0 max-w-[min(100%,34rem)] rounded-2xl rounded-br-md border border-[var(--border)] bg-[var(--gray-100)] px-4 py-3 text-sm leading-relaxed text-[var(--text)] shadow-sm whitespace-pre-wrap"
                >
                  {m.content}
                </div>
              </div>
            );
          }

          if (isAssistant) {
            return (
              <div key={`${i}-${m.role}`} className="flex w-full justify-start">
                <div className="mr-[18%] sm:mr-[22%] min-w-0 max-w-[min(100%,36rem)] rounded-2xl rounded-bl-md border border-[var(--color-primary)]/25 bg-white px-4 py-3 text-sm leading-relaxed text-[var(--text)] shadow-sm">
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
              <div className="text-sm text-[var(--text)]/90 whitespace-pre-wrap leading-relaxed">
                {m.content}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ViewerDataExplorer({
  data,
  selectedRisk,
  selectedRiskCategoryId,
  urlRiskCategory,
  onSubRiskSelectNavigateToCategory,
}: {
  data: ViewerData;
  selectedRisk?: { riskCategoryId: string; riskId: string } | null;
  selectedRiskCategoryId?: string | null;
  /** URL `[risk_category]` segment (`"all"` or category id); enables syncing the path when the risk dropdown implies another category. */
  urlRiskCategory?: string;
  /** Sync URL `[risk_category]`: concrete category id, or `"all"` for `/scenarios/all`. */
  onSubRiskSelectNavigateToCategory?: (riskCategoryId: string | "all") => void;
}) {
  const [selected, setSelected] = useState<Scenario | null>(null);
  const [ageRange, setAgeRange] = useState("all");
  const [risk, setRisk] = useState("all");
  const [prompt, setPrompt] = useState("all");
  const [grade, setGrade] = useState("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!selectedRisk) return;
    setRisk(selectedRisk.riskId);
    setSelected(null);
  }, [selectedRisk]);

  useEffect(() => {
    if (!selectedRiskCategoryId) return;
    setSelected(null);
  }, [selectedRiskCategoryId]);

  const scenarios = useMemo(() => data.scenarios ?? [], [data]);

  /** URL category changed (e.g. after navigation); clear sub-risk if it does not exist under this category. */
  useEffect(() => {
    if (risk === "all") return;
    const cat = selectedRiskCategoryId ?? null;
    if (!cat) return;
    const ok = scenarios.some(
      (s) => s.riskId === risk && s.riskCategoryId === cat
    );
    if (!ok) setRisk("all");
  }, [selectedRiskCategoryId, scenarios, risk]);

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

  const riskSelectLabel = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of scenarios) {
      if (!s.riskId) continue;
      if (map.has(s.riskId)) continue;
      const name = s.riskName?.trim();
      map.set(
        s.riskId,
        name && name !== s.riskId ? name : humanizeSlug(s.riskId)
      );
    }
    return map;
  }, [scenarios]);

  const filtered = useMemo(
    () =>
      scenarios.filter((s) => {
        const activeCategoryFilter = selectedRiskCategoryId ?? selectedRisk?.riskCategoryId;
        if (ageRange !== "all" && s.ageRange !== ageRange) return false;
        if (risk !== "all" && s.riskId !== risk) return false;
        if (
          activeCategoryFilter &&
          activeCategoryFilter !== "all" &&
          s.riskCategoryId !== activeCategoryFilter
        ) {
          return false;
        }
        if (prompt !== "all" && s.prompt !== prompt) return false;
        if (grade !== "all" && s.safetyGrade !== grade) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          const hay = [
            s.scenarioTitle,
            s.riskCategoryId,
            s.riskId,
            s.riskCategoryName,
            s.riskName,
            humanizeSlug(s.riskCategoryId),
            humanizeSlug(s.riskId),
          ]
            .filter(Boolean)
            .join("\n")
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      }),
    [scenarios, ageRange, risk, selectedRisk, selectedRiskCategoryId, prompt, grade, query]
  );

  function handleRiskSelectChange(nextRisk: string) {
    setRisk(nextRisk);
    setSelected(null);
    if (!onSubRiskSelectNavigateToCategory || urlRiskCategory === undefined) {
      return;
    }
    if (nextRisk === "all") {
      if (urlRiskCategory !== "all") {
        onSubRiskSelectNavigateToCategory("all");
      }
      return;
    }
    const sample = scenarios.find((s) => s.riskId === nextRisk);
    const cat = sample?.riskCategoryId?.trim();
    if (!cat) return;
    if (urlRiskCategory === "all" || urlRiskCategory !== cat) {
      onSubRiskSelectNavigateToCategory(cat);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_420px] gap-4">
      <div className="space-y-4">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            <select
              value={ageRange}
              onChange={(e) => setAgeRange(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
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
              onChange={(e) => handleRiskSelectChange(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
            >
              <option value="all">All Risks</option>
              {risks.map((v) => (
                <option key={v} value={v}>
                  {riskSelectLabel.get(v) ?? humanizeSlug(v)}
                </option>
              ))}
            </select>
            <select
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
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
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)]"
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
              className="rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] placeholder-[var(--muted)]"
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
          <div className="px-4 py-2 text-sm text-[var(--muted)] border-b border-[var(--border)]">
            {filtered.length} scenario(s)
          </div>
          <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[52rem] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--gray-100)] text-[10px] font-medium uppercase tracking-wide text-[var(--muted)]">
                  <th scope="col" className="px-4 py-2.5 align-bottom font-medium min-w-[10rem]">
                    Scenario
                  </th>
                  <th scope="col" className="px-3 py-2.5 align-bottom font-medium whitespace-nowrap w-28">
                    Age range
                  </th>
                  <th scope="col" className="px-3 py-2.5 align-bottom font-medium min-w-[9rem] w-[22%]">
                    Risk
                  </th>
                  <th scope="col" className="px-3 py-2.5 align-bottom font-medium whitespace-nowrap w-32">
                    Prompt variant
                  </th>
                  <th scope="col" className="px-4 py-2.5 align-bottom font-medium text-right w-36">
                    Assessment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]/80">
                {filtered.map((s, i) => {
                  const { primary: riskPrimary, secondary: riskSecondary } = scenarioRiskCell(s);
                  const isSelected = selected === s;
                  function activate() {
                    setSelected(s);
                  }
                  return (
                    <tr
                      key={`${s.id}-${i}`}
                      onClick={activate}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          activate();
                        }
                      }}
                      tabIndex={0}
                      role="button"
                      aria-pressed={isSelected}
                      className={`cursor-pointer transition-colors hover:bg-[var(--gray-100)] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--accent)]/50 ${
                        isSelected ? "bg-[var(--gray-100)]" : ""
                      }`}
                    >
                      <td className="px-4 py-2.5 align-top text-[var(--text)] font-medium min-w-0 max-w-[28rem]">
                        <div className="break-words leading-snug">{s.scenarioTitle}</div>
                      </td>
                      <td className="px-3 py-2.5 align-top text-[var(--muted)] tabular-nums whitespace-nowrap">
                        {formatAgeRangeLabel(s.ageRange)}
                      </td>
                      <td className="px-3 py-2.5 align-top min-w-0">
                        <div className="text-[var(--text)] font-medium break-words leading-snug">
                          {riskPrimary}
                        </div>
                        {riskSecondary ? (
                          <div className="mt-0.5 text-[11px] text-[var(--muted)] break-words leading-snug">
                            {riskSecondary}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2.5 align-top text-[var(--text)]/90 whitespace-nowrap">
                        {formatPromptVariantLabel(s.prompt)}
                      </td>
                      <td className="px-4 py-2.5 align-top text-right">
                        <SafetyGradeBadge grade={s.safetyGrade} className="shrink-0" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="rounded-xl border border-[var(--border)] bg-[var(--surface)] h-fit lg:sticky lg:top-24">
        {!selected ? (
          <div className="p-4 text-sm text-[var(--muted)]">
            Select a scenario to view details.
          </div>
        ) : (
          <div className="p-4 space-y-4 max-h-[82vh] overflow-auto">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[var(--text)] font-semibold leading-tight">
                {selected.scenarioTitle}
              </h3>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-xs rounded border border-[var(--border)] px-2 py-1 text-[var(--muted)] hover:bg-[var(--gray-100)]"
              >
                Close
              </button>
            </div>

            <ScenarioDetailMeta
              scenario={selected}
              targetModelSlug={data.summary?.target}
            />

            <div>
              <div className="flex flex-wrap items-center gap-2 text-[var(--text)]">
                <span className="text-sm font-bold tracking-tight">Assessment:</span>
                <SafetyGradeBadge grade={selected.safetyGrade} />
              </div>
              <div className="mt-2 h-px w-full bg-[var(--border)]" aria-hidden />
              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--gray-100)] px-3 py-3 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                {selected.assessmentReasons || "No assessment text."}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-[var(--text)]">
                <span className="text-sm font-bold tracking-tight">Scenario:</span>
              </div>
              <div className="mt-2 h-px w-full bg-[var(--border)]" aria-hidden />
              <div className="mt-3 rounded-md border border-[var(--border)] bg-[var(--gray-100)] px-3 py-3 text-sm leading-relaxed text-[var(--text)] whitespace-pre-wrap">
                {selected.narrative || "No scenario narrative."}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 text-[var(--text)]">
                <span className="text-sm font-bold tracking-tight">Conversation:</span>
              </div>
              <div className="mt-2 h-px w-full bg-[var(--border)]" aria-hidden />
              <ChatConversation messages={selected.messages || []} />
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
