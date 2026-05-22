"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import requestsClient from "lib/requests-client";
import { viewerDataRequest } from "lib/viewerDataApi";
import { EvaluationRunTracker } from "components/EvaluationRunTracker";
import { ResultsOverview } from "components/ResultsOverview";
import { useActiveEvaluationRun } from "hooks/useActiveEvaluationRun";
import type { ViewerData } from "lib/viewerDataFromZip";

const PROMPTS = ["default", "child"];

/** Slug for HTTP custom backend (see benchmark runCommand custom-* routing) */
const CUSTOM_MODEL_SLUG = "custom-my-model";
const ADD_CUSTOM_TARGET_OPTION = "__add_custom_target_model__";

function ModelField({
  label,
  value,
  onChange,
  modelList,
  required,
  placeholder,
  dropdownOnly,
  optionLabels,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  modelList: string[];
  required?: boolean;
  placeholder?: string;
  dropdownOnly?: boolean;
  /** Optional display labels for select options (value → label) */
  optionLabels?: Record<string, string>;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-[var(--muted)] mb-1">
        {label} {required && <span className="text-[var(--error)]">*</span>}
      </label>
      <div className="flex gap-2">
        <select
          value={modelList.includes(value) ? value : ""}
          onChange={(e) => {
            const v = e.target.value;
            if (v) onChange(v);
          }}
          required={required}
          className={
            dropdownOnly
              ? "w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
              : "shrink-0 w-[180px] rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
          }
          aria-label={`${label} preset`}
        >
          <option value="">— Model List —</option>
          {modelList.map((m) => (
            <option key={m} value={m}>
              {optionLabels?.[m] ?? m}
            </option>
          ))}
        </select>
        {!dropdownOnly && (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={required}
            placeholder={placeholder}
            className="min-w-0 max-w-[240px] flex-1 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}

type FlowPhase = "idle" | "running" | "complete";

function PipelineStepper({ phase }: { phase: FlowPhase }) {
  const steps = [
    { n: 1, title: "Generate seeds", desc: "" },
    { n: 2, title: "Expand scenarios", desc: "" },
    { n: 3, title: "Run benchmark", desc: "Evaluate target model" },
  ];

  const statusFor = (stepNum: number) => {
    if (stepNum <= 2) {
      return "done" as const;
    }
    if (phase === "idle") return "pending" as const;
    if (phase === "running") return "active" as const;
    return "done" as const;
  };

  return (
    <div className="mb-6 flex flex-wrap items-stretch justify-between gap-2 md:gap-0">
      {steps.map((s, i) => {
        const st = statusFor(s.n);
        const isLast = i === steps.length - 1;
        return (
          <div key={s.n} className="flex min-w-[140px] flex-1 items-center">
            <div className="flex flex-1 flex-col items-center text-center">
              <div
                className={[
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold transition-colors",
                  st === "done"
                    ? "border-[var(--success)] bg-[var(--success)]/20 text-[var(--success)]"
                    : st === "active"
                      ? "border-[var(--accent)] bg-[var(--accent)]/25 text-[var(--accent)] animate-pulse"
                      : "border-[var(--border)] bg-black/30 text-[var(--muted)]",
                ].join(" ")}
              >
                {st === "done" ? "✓" : s.n}
              </div>
              <div className="mt-2 text-xs font-semibold text-white">{s.title}</div>
              <div className="text-[10px] text-[var(--muted)] leading-tight px-1">{s.desc}</div>
            </div>
            {!isLast && (
              <div
                className="hidden h-0.5 flex-1 self-start mt-5 min-w-[12px] md:block bg-[var(--border)]"
                aria-hidden
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [modelList, setModelList] = useState<string[]>([]);
  const [customModelList, setCustomModelList] = useState<string[]>([]);
  const [overviewData, setOverviewData] = useState<ViewerData | null>(null);

  const refreshOverviewFromRun = useCallback(async (runId?: string | null) => {
    try {
      const req = runId
        ? viewerDataRequest(runId)
        : { url: "/api/scenarios/viewer-data" as const };
      const vr = await requestsClient.get<ViewerData>(req.url, {
        params: "params" in req ? req.params : undefined,
        validateStatus: () => true,
      });
      if (vr.status >= 200 && vr.status < 300) {
        setOverviewData(vr.data);
      }
    } catch {
      /* run may not have viewer rows yet */
    }
  }, []);

  const {
    run: activeRun,
    loading: runLoading,
    starting,
    cancelling,
    isInFlight,
    pollError,
    startEvaluation,
    cancelEvaluation,
    refreshRun,
  } = useActiveEvaluationRun({
    onCompleted: (runId) => {
      void refreshOverviewFromRun(runId);
    },
  });

  const flowPhase: FlowPhase =
    activeRun?.status === "completed"
      ? "complete"
      : isInFlight
        ? "running"
        : "idle";

  useEffect(() => {
    requestsClient
      .get<{ models?: string[]; customModels?: string[] }>("/api/models", { validateStatus: () => true })
      .then((r) => {
        const data = r.data ?? {};
        setModelList(data.models ?? []);
        setCustomModelList(data.customModels ?? []);
      })
      .catch(() => {
        setModelList([]);
        setCustomModelList([]);
      });
  }, []);

  useEffect(() => {
    if (activeRun?.status === "completed" && activeRun.id) {
      void refreshOverviewFromRun(activeRun.id);
    }
  }, [activeRun?.status, activeRun?.id, refreshOverviewFromRun]);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-7xl mx-auto">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Child Safety Benchmark
          </h1>
          <p className="text-[var(--muted)] mt-1">
            Run evaluations using pre-generated seeds and scenarios.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Home
          </Link>
          <Link
            href="/models"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Models
          </Link>
          <Link
            href="/benchmark/runs"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Runs
          </Link>
        </div>
      </header>

      <PipelineForm
        onRun={startEvaluation}
        disabled={isInFlight}
        modelList={modelList}
        customModelList={customModelList}
        flowPhase={flowPhase}
      />

      {(activeRun || starting || pollError || runLoading) && (
        <EvaluationRunTracker
          run={activeRun}
          pollError={pollError}
          loading={runLoading}
          starting={starting}
          cancelling={cancelling}
          onRefresh={refreshRun}
          onCancel={cancelEvaluation}
        />
      )}

      {overviewData && (
        <div className="mt-10 rounded-xl border border-[var(--border)] bg-[var(--surface)]/80 p-5 md:p-6">
          <ResultsOverview
            data={overviewData}
            scenariosHref="/benchmark/runs"
            uploadLabel="Latest evaluation results"
          />
        </div>
      )}
    </div>
  );
}

function PipelineForm({
  onRun,
  disabled,
  modelList,
  customModelList,
  flowPhase,
}: {
  onRun: (payload: {
    apiKey: string;
    customApiKey?: string;
    customApiEndpoint?: string;
    customParsingKey?: string;
    targetModel: string;
    judgeModel?: string;
    userModel?: string;
    prompts?: string[];
  }) => void;
  disabled: boolean;
  modelList: string[];
  customModelList: string[];
  flowPhase: FlowPhase;
}) {
  const shouldShowSyntheticCustomTarget =
    customModelList.length === 0 && !modelList.includes(CUSTOM_MODEL_SLUG);

  const targetModelOptions = useMemo(() => {
    const list = [...modelList];
    // Show one-click custom option only if no saved custom models exist yet.
    if (shouldShowSyntheticCustomTarget) {
      list.unshift(ADD_CUSTOM_TARGET_OPTION);
    }
    return list;
  }, [modelList, shouldShowSyntheticCustomTarget]);

  const nonCustomModelOptions = useMemo(
    () => modelList.filter((m) => !customModelList.includes(m)),
    [customModelList, modelList]
  );

  const [apiKey, setApiKey] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyStatusLoading, setApiKeyStatusLoading] = useState(true);
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);
  const [targetModel, setTargetModel] = useState("gpt-4o");
  const [judgeModel, setJudgeModel] = useState("gpt-5.2:high:limited");
  const [userModel, setUserModel] = useState("deepseek-v3.2");
  const [prompts, setPrompts] = useState<string[]>(["default"]);
  const [customApiEndpoint, setCustomApiEndpoint] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customParsingKey, setCustomParsingKey] = useState("message");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setApiKeyStatusLoading(true);
      try {
        const r = await requestsClient.get<{ has_key?: boolean }>("/api/account/ai-gateway-key", {
          validateStatus: () => true,
        });
        const j = r.data ?? {};
        if (!cancelled) setHasSavedApiKey(Boolean(j.has_key));
      } catch {
        if (!cancelled) setHasSavedApiKey(false);
      } finally {
        if (!cancelled) setApiKeyStatusLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const targetOptionLabels = useMemo(() => {
    if (!shouldShowSyntheticCustomTarget) return undefined;
    return {
      [ADD_CUSTOM_TARGET_OPTION]: "Add custom target model",
    };
  }, [shouldShowSyntheticCustomTarget]);

  const isCustomTarget = targetModel === ADD_CUSTOM_TARGET_OPTION;

  const togglePrompt = (p: string) => {
    setPrompts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRun({
      apiKey: apiKey.trim(),
      ...(isCustomTarget
        ? {
            customApiKey: customApiKey.trim(),
            customApiEndpoint: customApiEndpoint.trim(),
            customParsingKey: customParsingKey.trim() || "message",
          }
        : {}),
      targetModel: isCustomTarget ? CUSTOM_MODEL_SLUG : targetModel.trim(),
      judgeModel: judgeModel || undefined,
      userModel: userModel || undefined,
      prompts: prompts.length ? prompts : undefined,
    });
  };

  const saveApiKey = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setApiKeyMessage("Enter an API key to save.");
      return;
    }
    setSavingApiKey(true);
    setApiKeyMessage(null);
    try {
      const r = await requestsClient.put<{ error?: string }>(
        "/api/account/ai-gateway-key",
        { apiKey: trimmed },
        { validateStatus: () => true }
      );
      const j = r.data ?? {};
      if (r.status < 200 || r.status >= 300) {
        setApiKeyMessage(j.error || "Could not save API key.");
        return;
      }
      setHasSavedApiKey(true);
      setApiKey("");
      setApiKeyMessage("Saved encrypted API key to your account.");
    } catch (e) {
      setApiKeyMessage((e as Error).message);
    } finally {
      setSavingApiKey(false);
    }
  }, [apiKey]);

  const canSubmit =
    (apiKey.trim() || hasSavedApiKey) &&
    targetModel.trim() &&
    (!isCustomTarget ||
      (customApiEndpoint.trim().length > 0 && customApiKey.trim().length > 0));

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-white mb-1">Pipeline</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Helper text.
        </p>

        <PipelineStepper phase={flowPhase === "complete" ? "complete" : flowPhase === "running" ? "running" : "idle"} />

        <div className="mb-6">
          <div className="mb-1 flex items-center gap-2">
            <label className="block text-sm font-medium text-[var(--muted)]">
              AI Gateway API Key <span className="text-[var(--error)]">*</span>
            </label>
            {!apiKeyStatusLoading && hasSavedApiKey && (
              <span className="rounded-full border border-[var(--success)]/50 bg-[var(--success)]/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--success)]">
                Saved to account
              </span>
            )}
          </div>
          <div className="flex max-w-xl items-center gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                hasSavedApiKey
                  ? "Saved key exists. Enter a new key to override this run."
                  : "Enter key for this run, or save it to account"
              }
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void saveApiKey()}
              disabled={savingApiKey || !apiKey.trim()}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-white hover:bg-[var(--border)] disabled:opacity-50"
            >
              {savingApiKey ? "Saving..." : "Save key"}
            </button>
          </div>
          <p
            className={`mt-1 text-xs ${
              apiKeyStatusLoading
                ? "text-[var(--muted)]"
                : hasSavedApiKey
                  ? "text-[var(--success)]"
                  : "text-[var(--muted)]"
            }`}
          >
            {apiKeyStatusLoading
              ? "Checking saved key status..."
              : hasSavedApiKey
                ? "A saved AI Gateway API key is available and will be used if this field is left blank."
                : "No saved key yet."}
          </p>
          {apiKeyMessage && (
            <p className="mt-1 text-xs text-[var(--muted)]">{apiKeyMessage}</p>
          )}
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Step 1 — read-only */}
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4 opacity-95">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--success)]">Ready</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">Step 1: Generate seeds</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Scenario seeds have been pre-generated. Default model used is gpt-5.2:high.
            </p>
          </div>

          {/* Step 2 — read-only */}
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4 opacity-95">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--success)]">Ready</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">Step 2: Expand scenarios</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Expanded scenarios have been pre-generated. Default scenario expander model used is gpt-4o.
            </p>
          </div>

          {/* Step 3 — editable */}
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4 ring-1 ring-[var(--accent)]/30">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--accent)]">Active</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-3">Step 3: Run benchmark</h3>
            <div className="space-y-3">
              <ModelField
                label="Target model"
                value={targetModel}
                onChange={setTargetModel}
                modelList={targetModelOptions}
                optionLabels={targetOptionLabels}
                required
                placeholder="gpt-4o"
                dropdownOnly
              />
              {isCustomTarget && (
                <div className="space-y-3 rounded-lg border border-[var(--border)] bg-black/25 p-3">
                  <p className="text-xs text-[var(--muted)] leading-relaxed">
                    Custom calls use <code className="text-white">CUSTOM_API_KEY</code> and{" "}
                    <code className="text-white">CUSTOM_MODEL_API_ENDPOINT</code> for this run only (not saved).
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                      Custom API endpoint <span className="text-[var(--error)]">*</span>
                    </label>
                    <input
                      type="text"
                      value={customApiEndpoint}
                      onChange={(e) => setCustomApiEndpoint(e.target.value)}
                      placeholder="https://example.com/v1/chat"
                      className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                      Custom model API key <span className="text-[var(--error)]">*</span>
                    </label>
                    <input
                      type="password"
                      value={customApiKey}
                      onChange={(e) => setCustomApiKey(e.target.value)}
                      placeholder="Passed as CUSTOM_API_KEY"
                      className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                      Parsing key
                    </label>
                    <input
                      type="text"
                      value={customParsingKey}
                      onChange={(e) => setCustomParsingKey(e.target.value)}
                      placeholder="message"
                      className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-sm text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                    />
                    <p className="mt-1 text-xs text-[var(--muted)]">
                      Response field to read text from (supports dot paths, e.g.{" "}
                      <code className="text-white">data.message</code>).
                    </p>
                  </div>
                </div>
              )}
              <ModelField
                label="Judge model"
                value={judgeModel}
                onChange={setJudgeModel}
                modelList={nonCustomModelOptions}
                placeholder="gpt-5.2:high:limited"
                dropdownOnly
              />
              <ModelField
                label="User model"
                value={userModel}
                onChange={setUserModel}
                modelList={nonCustomModelOptions}
                placeholder="deepseek-v3.2"
                dropdownOnly
              />
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-2">Prompt variants</label>
                <div className="flex flex-wrap gap-2">
                  {PROMPTS.map((p) => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={prompts.includes(p)}
                        onChange={() => togglePrompt(p)}
                        className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
                      />
                      <span className="text-sm text-white">{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={disabled || !canSubmit}
            className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Run benchmark
          </button>
        </div>
      </section>
    </form>
  );
}
