"use client";

import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { SignInForm } from "components/SignInForm";
import { useSession } from "hooks/useSession";
import { notifySessionUpdated } from "lib/session-events";
import requestsClient from "lib/requests-client";
import { viewerDataRequest } from "lib/viewerDataApi";
import { EvaluationRunTracker } from "components/EvaluationRunTracker";
import { PageContainer } from "components/PageContainer";
import { ResumableEvaluationBanner } from "components/ResumableEvaluationBanner";
import BenchmarkScenariosPreview from "components/BenchmarkScenariosPreview";
import { ResultsOverview } from "components/ResultsOverview";
import { useActiveEvaluationRun } from "hooks/useActiveEvaluationRun";
import { uniqueCustomModelSlug } from "lib/customModel";
import { formatPromptVariantLabel } from "lib/promptVariantLabel";
import type { ViewerData } from "lib/viewerDataFromZip";

const PROMPTS = ["default", "child"];

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
              ? "w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
              : "shrink-0 w-[180px] rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] focus:border-[var(--accent)] focus:outline-none"
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
            className="min-w-0 max-w-[240px] flex-1 rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        )}
      </div>
    </div>
  );
}

type FlowPhase = "idle" | "running" | "complete";

function PipelineChecklist({
  phase,
  prompts,
  runStep,
}: {
  phase: FlowPhase;
  prompts: string[];
  runStep: ReactNode;
}) {
  const runChecked = phase === "complete";
  const runActive = phase === "running" || phase === "idle";

  const steps = [
    {
      id: "seeds",
      title: "Generate seeds",
      checked: true,
      body: (
        <p className="text-xs text-[var(--muted)] leading-relaxed">
          Scenario seeds have been pre-generated. Default model used is gpt-5.2:high.
        </p>
      ),
    },
    {
      id: "scenarios",
      title: "Expand scenarios",
      checked: true,
      body: (
        <>
          <p className="text-xs text-[var(--muted)] leading-relaxed">
            Expanded scenarios have been pre-generated. Default scenario expander model used is
            gpt-4o.
          </p>
          <BenchmarkScenariosPreview prompts={prompts} embedded />
        </>
      ),
    },
    {
      id: "run",
      title: "Run benchmark",
      checked: runChecked,
      active: runActive && !runChecked,
      body: runStep,
    },
  ];

  return (
    <ol className="mb-6 list-none space-y-0 pl-0" aria-label="Benchmark pipeline">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <li key={step.id} className="relative flex gap-4 pb-8 last:pb-0">
            {!isLast && (
              <div
                className="absolute left-[11px] top-6 bottom-0 w-px bg-[var(--border)]"
                aria-hidden
              />
            )}
            <div
              className={[
                "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded border-2 bg-[var(--surface)] transition-colors",
                step.checked
                  ? "border-[var(--success)] bg-[var(--success)]/20"
                  : step.active
                    ? "border-[var(--accent)] bg-[var(--accent)]/20"
                    : "border-[var(--border)] bg-white",
              ].join(" ")}
            >
              <input
                type="checkbox"
                checked={step.checked}
                readOnly
                disabled
                tabIndex={-1}
                aria-hidden
                className="sr-only"
              />
              {step.checked ? (
                <span className="text-xs font-bold text-[var(--success)]" aria-hidden>
                  ✓
                </span>
              ) : (
                <span
                  className={[
                    "h-2 w-2 rounded-full",
                    step.active ? "bg-[var(--accent)] animate-pulse" : "bg-transparent",
                  ].join(" ")}
                  aria-hidden
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h3
                className={[
                  "text-sm font-semibold",
                  step.active ? "text-[var(--accent)]" : "text-[var(--text)]",
                ].join(" ")}
              >
                {step.title}
              </h3>
              <div className="mt-2">{step.body}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function BenchmarkSignedOut() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-[var(--muted)]">
          Loading…
        </div>
      }
    >
      <SignInForm
        nextPath="/benchmark"
        onAuthenticated={() => {
          notifySessionUpdated();
        }}
      />
    </Suspense>
  );
}

function BenchmarkAuthenticated() {
  const [modelList, setModelList] = useState<string[]>([]);
  const [customModelList, setCustomModelList] = useState<string[]>([]);
  const [customModelLabels, setCustomModelLabels] = useState<Record<string, string>>({});
  const [overviewData, setOverviewData] = useState<ViewerData | null>(null);

  const loadModels = useCallback(async () => {
    try {
      const r = await requestsClient.get<{
        models?: string[];
        customModels?: string[];
        customModelLabels?: Record<string, string>;
      }>("/api/models", { validateStatus: () => true });
      const data = r.data ?? {};
      setModelList(data.models ?? []);
      setCustomModelList(data.customModels ?? []);
      setCustomModelLabels(data.customModelLabels ?? {});
    } catch {
      setModelList([]);
      setCustomModelList([]);
      setCustomModelLabels({});
    }
  }, []);

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
    resumableRun,
    loading: runLoading,
    starting,
    cancelling,
    isInFlight,
    pollError,
    startEvaluation,
    cancelEvaluation,
    dismissResumable,
    refreshRun,
  } = useActiveEvaluationRun({
    onCompleted: (runId) => {
      void refreshOverviewFromRun(runId);
    },
  });

  const flowPhase: FlowPhase = isInFlight ? "running" : "idle";

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  return (
    <PageContainer>
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text)] tracking-tight">
            Youth Mental Wellbeing Benchmark
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/models"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)]"
          >
            Models
          </Link>
          <Link
            href="/benchmark/runs"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)]"
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
        customModelLabels={customModelLabels}
        onModelsRefresh={loadModels}
        flowPhase={flowPhase}
      />

      {resumableRun && (
        <ResumableEvaluationBanner
          run={resumableRun}
          onDismiss={dismissResumable}
        />
      )}

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
    </PageContainer>
  );
}

export default function Home() {
  const { authReady, isSignedIn } = useSession();

  if (!authReady) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm text-[var(--muted)]">
        Loading…
      </div>
    );
  }

  if (!isSignedIn) {
    return <BenchmarkSignedOut />;
  }

  return <BenchmarkAuthenticated />;
}

function PipelineForm({
  onRun,
  disabled,
  modelList,
  customModelList,
  customModelLabels,
  onModelsRefresh,
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
  }) => void | Promise<void>;
  disabled: boolean;
  modelList: string[];
  customModelList: string[];
  customModelLabels: Record<string, string>;
  onModelsRefresh: () => Promise<void>;
  flowPhase: FlowPhase;
}) {
  const targetModelOptions = useMemo(
    () => [...modelList, ADD_CUSTOM_TARGET_OPTION],
    [modelList]
  );

  const nonCustomModelOptions = useMemo(
    () => modelList.filter((m) => !customModelList.includes(m)),
    [customModelList, modelList]
  );

  const [apiKey, setApiKey] = useState("");
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiKeyStatusLoading, setApiKeyStatusLoading] = useState(true);
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);
  const [apiKeyExpanded, setApiKeyExpanded] = useState(true);
  const [targetModel, setTargetModel] = useState("gpt-4o");
  const [judgeModel, setJudgeModel] = useState("gpt-5.2:medium:limited");
  const [userModel, setUserModel] = useState("deepseek-v3.2");
  const [prompts, setPrompts] = useState<string[]>(["default"]);
  const [customDisplayName, setCustomDisplayName] = useState("");
  const [customApiEndpoint, setCustomApiEndpoint] = useState("");
  const [customApiKey, setCustomApiKey] = useState("");
  const [customParsingKey, setCustomParsingKey] = useState("message");
  const [savingCustomModel, setSavingCustomModel] = useState(false);
  const [customModelMessage, setCustomModelMessage] = useState<string | null>(null);

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

  useEffect(() => {
    if (apiKeyStatusLoading) return;
    setApiKeyExpanded(!hasSavedApiKey);
  }, [apiKeyStatusLoading, hasSavedApiKey]);

  const apiKeySectionOpen = apiKeyStatusLoading || !hasSavedApiKey || apiKeyExpanded;

  const targetOptionLabels = useMemo(() => {
    const labels: Record<string, string> = {
      [ADD_CUSTOM_TARGET_OPTION]: "Add custom model…",
    };
    for (const slug of customModelList) {
      labels[slug] = customModelLabels[slug] ?? slug;
    }
    return labels;
  }, [customModelList, customModelLabels]);

  const isCustomTarget = targetModel === ADD_CUSTOM_TARGET_OPTION;
  const isCustomTargetModel =
    isCustomTarget || customModelList.includes(targetModel);

  useEffect(() => {
    if (isCustomTargetModel) {
      setPrompts(["default"]);
    }
  }, [isCustomTargetModel]);

  const togglePrompt = (p: string) => {
    if (isCustomTargetModel) return;
    setPrompts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const saveCustomModelToAccount = useCallback(async (): Promise<string | null> => {
    const displayName = customDisplayName.trim();
    if (!displayName) {
      setCustomModelMessage("Enter a display name for this model.");
      return null;
    }
    if (!customApiEndpoint.trim() || !customApiKey.trim()) {
      setCustomModelMessage("Custom API endpoint and API key are required.");
      return null;
    }
    const slug = uniqueCustomModelSlug(displayName, modelList);
    setSavingCustomModel(true);
    setCustomModelMessage(null);
    try {
      const res = await requestsClient.put<{ error?: string }>(
        "/api/models",
        {
          slug,
          config: {
            model: slug,
            displayName,
            customApiEndpoint: customApiEndpoint.trim(),
            customApiKey: customApiKey.trim(),
            parsingKey: customParsingKey.trim() || "message",
          },
        },
        { validateStatus: () => true }
      );
      const data = res.data ?? {};
      if (res.status < 200 || res.status >= 300) {
        setCustomModelMessage(data.error ?? "Could not save custom model.");
        return null;
      }
      await onModelsRefresh();
      setTargetModel(slug);
      setCustomModelMessage(`Saved "${displayName}" to your account.`);
      return slug;
    } catch (e) {
      setCustomModelMessage((e as Error).message);
      return null;
    } finally {
      setSavingCustomModel(false);
    }
  }, [
    customApiEndpoint,
    customApiKey,
    customDisplayName,
    customParsingKey,
    modelList,
    onModelsRefresh,
  ]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let resolvedTarget = targetModel.trim();
    if (isCustomTarget) {
      const slug = await saveCustomModelToAccount();
      if (!slug) return;
      resolvedTarget = slug;
    }
    const runUsesCustomTarget =
      resolvedTarget.startsWith("custom-") || customModelList.includes(resolvedTarget);
    await onRun({
      apiKey: apiKey.trim(),
      targetModel: resolvedTarget,
      judgeModel: judgeModel || undefined,
      userModel: userModel || undefined,
      prompts: runUsesCustomTarget
        ? ["default"]
        : prompts.length
          ? prompts
          : undefined,
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
      setApiKeyExpanded(false);
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
      (customDisplayName.trim().length > 0 &&
        customApiEndpoint.trim().length > 0 &&
        customApiKey.trim().length > 0));

  const pipelinePhase: FlowPhase =
    flowPhase === "complete" ? "complete" : flowPhase === "running" ? "running" : "idle";

  const runStep = (
    <div className="space-y-4 rounded-lg border border-[var(--border)] bg-[var(--gray-100)] p-4 ring-1 ring-[var(--accent)]/25">
      <div className="space-y-3">
        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <label className="block text-sm font-medium text-[var(--muted)]">
                AI Gateway API Key <span className="text-[var(--error)]">*</span>
              </label>
              {!apiKeyStatusLoading && (
                <span
                  className={[
                    "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                    hasSavedApiKey
                      ? "border border-[var(--success)]/50 bg-[var(--success)]/15 text-[var(--success)]"
                      : "border border-[var(--border)] bg-white text-[var(--muted)]",
                  ].join(" ")}
                >
                  {hasSavedApiKey ? "Saved to Account" : "Not Saved"}
                </span>
              )}
            </div>
            {!apiKeyStatusLoading && hasSavedApiKey && (
              <button
                type="button"
                onClick={() => setApiKeyExpanded((open) => !open)}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
                aria-expanded={apiKeySectionOpen}
              >
                {apiKeyExpanded ? "Hide" : "Change"}
              </button>
            )}
          </div>

          {apiKeySectionOpen ? (
            <>
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
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => void saveApiKey()}
                  disabled={savingApiKey || !apiKey.trim()}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)] disabled:opacity-50"
                >
                  {savingApiKey ? "Saving..." : "Save key"}
                </button>
              </div>
              {apiKeyMessage && (
                <p className="mt-1 text-xs text-[var(--muted)]">{apiKeyMessage}</p>
              )}
            </>
          ) : null}
        </div>

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
          <div className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--gray-100)] p-3">
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Add a custom HTTP target. Credentials are saved to your account so you can reuse this
              model in future runs.
            </p>
            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                Display name <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                value={customDisplayName}
                onChange={(e) => setCustomDisplayName(e.target.value)}
                placeholder="E.g. My AI Tutor, Companion Chatbot"
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                autoComplete="off"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                Custom API endpoint <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                value={customApiEndpoint}
                onChange={(e) => setCustomApiEndpoint(e.target.value)}
                placeholder="https://example.com/v1/chat"
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
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
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
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
                className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              />
              <p className="mt-1 text-xs text-[var(--muted)]">
                Response field to read text from (supports dot paths, e.g.{" "}
                <code className="text-[var(--text)]">data.message</code>).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void saveCustomModelToAccount()}
                disabled={savingCustomModel || disabled}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-[var(--text)] hover:bg-[var(--gray-100)] disabled:opacity-50"
              >
                {savingCustomModel ? "Saving…" : "Save custom model"}
              </button>
            </div>
            {customModelMessage && (
              <p className="text-xs text-[var(--muted)]">{customModelMessage}</p>
            )}
          </div>
        )}
        <ModelField
          label="Judge model"
          value={judgeModel}
          onChange={setJudgeModel}
          modelList={nonCustomModelOptions}
          placeholder="gpt-5.2:medium:limited"
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
          {isCustomTargetModel && (
            <p className="mb-2 text-xs text-[var(--muted)]">
              Custom target models use the Assistant prompt only.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {PROMPTS.map((p) => (
              <label
                key={p}
                className={[
                  "flex items-center gap-2",
                  isCustomTargetModel ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={prompts.includes(p)}
                  onChange={() => togglePrompt(p)}
                  disabled={isCustomTargetModel}
                  className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)] disabled:cursor-not-allowed"
                />
                <span className="text-sm text-[var(--text)]">{formatPromptVariantLabel(p)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={disabled || !canSubmit || savingCustomModel}
        className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Run benchmark
      </button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-[var(--text)] mb-1">Evaluation Pipeline</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
        Run youth mental wellbeing evaluations against a target model using pre-generated test scenarios. Configure the target model below.
        </p>

        <PipelineChecklist phase={pipelinePhase} prompts={prompts} runStep={runStep} />
      </section>
    </form>
  );
}
