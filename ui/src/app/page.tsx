"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const PROMPTS = ["default", "child"];

/** Unique result filename: ISO timestamp + random suffix for collision safety */
function makeResultFilename(): string {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rand = Math.random().toString(36).slice(2, 8);
  return `results-${ts}-${rand}.json`;
}

function ModelField({
  label,
  value,
  onChange,
  modelList,
  required,
  placeholder,
  dropdownOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  modelList: string[];
  required?: boolean;
  placeholder?: string;
  dropdownOnly?: boolean;
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
              {m}
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
    { n: 1, title: "Generate seeds", desc: "scenarioSeeds.jsonl" },
    { n: 2, title: "Expand scenarios", desc: "scenarios.jsonl" },
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
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [modelList, setModelList] = useState<string[]>([]);
  const [flowPhase, setFlowPhase] = useState<FlowPhase>("idle");
  const [lastResultFile, setLastResultFile] = useState<string | null>(null);
  const [autoRunSeed, setAutoRunSeed] = useState<{
    apiKey: string;
    customApiKey?: string;
    targetModel: string;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models?: string[] }) => setModelList(data.models ?? []))
      .catch(() => setModelList([]));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldAutoRun = params.get("autorun") === "1";
    const targetModel = params.get("targetModel")?.trim() || "";
    if (!shouldAutoRun || !targetModel) return;
    const raw = sessionStorage.getItem("kora_custom_run_payload") ?? "";
    sessionStorage.removeItem("kora_custom_run_payload");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as {
        aiGatewayApiKey?: string;
        customApiKey?: string;
      };
      const apiKey = parsed.aiGatewayApiKey?.trim() ?? "";
      if (!apiKey) return;
      setAutoRunSeed({
        apiKey,
        customApiKey: parsed.customApiKey?.trim() || undefined,
        targetModel,
      });
    } catch {
      return;
    }
  }, []);

  const runBuild = useCallback(async () => {
    abortRef.current = new AbortController();
    setRunning(true);
    setOutput("Building benchmark...\n\n");

    try {
      const res = await fetch("/api/build", {
        method: "POST",
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        setOutput((prev) => prev + `Build request failed: ${res.status}`);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setOutput((prev) => prev + "No response body");
        return;
      }

      let text = "Building benchmark...\n\n";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setOutput(text);
      }
    } catch (e) {
      if ((e as Error).name === "AbortError") {
        setOutput((prev) => prev + "\n\n[Stopped by user]");
      } else {
        setOutput((prev) => prev + `\n\nError: ${(e as Error).message}`);
      }
    } finally {
      setRunning(false);
      abortRef.current = null;
    }
  }, []);

  const runBenchmark = useCallback(
    async (payload: {
      apiKey: string;
      customApiKey?: string;
      targetModel: string;
      judgeModel?: string;
      userModel?: string;
      prompts?: string[];
    }) => {
      const resultBasename = makeResultFilename();
      const outputPath = `data/${resultBasename}`;

      abortRef.current = new AbortController();
      setRunning(true);
      setFlowPhase("running");
      setLastResultFile(null);
      setOutput(`Writing results to ${outputPath}\n\n`);

      try {
        const res = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            command: "run",
            apiKey: payload.apiKey,
            customApiKey: payload.customApiKey,
            targetModel: payload.targetModel,
            judgeModel: payload.judgeModel,
            userModel: payload.userModel,
            input: "data/scenarios.jsonl",
            output: outputPath,
            prompts: payload.prompts,
            syncViewer: true,
          }),
          signal: abortRef.current.signal,
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const data = err as { error?: string; code?: string };
          const msg =
            data.code === "CLI_NOT_BUILT"
              ? `${data.error}\n\nUse the "Build benchmark" button first.`
              : `Error ${res.status}: ${data.error ?? res.statusText}`;
          setOutput(msg);
          setFlowPhase("idle");
          return;
        }

        const reader = res.body?.getReader();
        const decoder = new TextDecoder();
        if (!reader) {
          setOutput("No response body");
          setFlowPhase("idle");
          return;
        }

        let text = `Writing results to ${outputPath}\n\n`;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setOutput(text);
        }
        setLastResultFile(resultBasename);
        setFlowPhase("complete");
      } catch (e) {
        if ((e as Error).name === "AbortError") {
          setOutput((prev) => prev + "\n\n[Stopped by user]");
        } else {
          setOutput((prev) => prev + `\n\nError: ${(e as Error).message}`);
        }
        setFlowPhase("idle");
      } finally {
        setRunning(false);
        abortRef.current = null;
      }
    },
    []
  );

  const stop = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-5xl mx-auto">
      <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            KORA Child Safety Evaluations
          </h1>
          <p className="text-[var(--muted)] mt-1">
            Build benchmark, then run evaluations using pre-generated seeds and scenarios.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/models"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Models
          </Link>
          <Link
            href="/results"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Results
          </Link>
          <button
            type="button"
            onClick={runBuild}
            disabled={running}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)] disabled:opacity-50"
          >
            Build benchmark
          </button>
        </div>
      </header>

      <PipelineForm
        onRun={runBenchmark}
        disabled={running}
        modelList={modelList}
        flowPhase={flowPhase}
        lastResultFile={lastResultFile}
        autoRunSeed={autoRunSeed}
      />

      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-black/30">
          <span className="text-sm font-medium text-[var(--muted)]">Output</span>
          {running && (
            <button
              type="button"
              onClick={stop}
              className="text-sm px-3 py-1 rounded bg-[var(--error)]/20 text-[var(--error)] hover:bg-[var(--error)]/30"
            >
              Stop
            </button>
          )}
        </div>
        <pre className="p-4 text-sm text-[var(--text)] overflow-auto max-h-[400px] font-mono whitespace-pre-wrap break-words">
          {output || "Run benchmark to see output."}
        </pre>
      </div>
    </div>
  );
}

function PipelineForm({
  onRun,
  disabled,
  modelList,
  flowPhase,
  lastResultFile,
  autoRunSeed,
}: {
  onRun: (payload: {
    apiKey: string;
    customApiKey?: string;
    targetModel: string;
    judgeModel?: string;
    userModel?: string;
    prompts?: string[];
  }) => void;
  disabled: boolean;
  modelList: string[];
  flowPhase: FlowPhase;
  lastResultFile: string | null;
  autoRunSeed: { apiKey: string; customApiKey?: string; targetModel: string } | null;
}) {
  const [apiKey, setApiKey] = useState("");
  const [targetModel, setTargetModel] = useState("gpt-4o");
  const [judgeModel, setJudgeModel] = useState("gpt-5.2:high:limited");
  const [userModel, setUserModel] = useState("deepseek-v3.2");
  const [prompts, setPrompts] = useState<string[]>(["default"]);
  const autoRunDoneRef = useRef(false);

  const togglePrompt = (p: string) => {
    setPrompts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRun({
      apiKey: apiKey.trim(),
      customApiKey: autoRunSeed?.customApiKey,
      targetModel: targetModel.trim(),
      judgeModel: judgeModel || undefined,
      userModel: userModel || undefined,
      prompts: prompts.length ? prompts : undefined,
    });
  };

  const downloadHref =
    lastResultFile != null
      ? `/api/results/download?file=${encodeURIComponent(lastResultFile)}`
      : null;

  useEffect(() => {
    if (!autoRunSeed || autoRunDoneRef.current) return;
    autoRunDoneRef.current = true;
    setApiKey(autoRunSeed.apiKey);
    setTargetModel(autoRunSeed.targetModel);
    onRun({
      apiKey: autoRunSeed.apiKey,
      customApiKey: autoRunSeed.customApiKey,
      targetModel: autoRunSeed.targetModel,
      judgeModel: judgeModel || undefined,
      userModel: userModel || undefined,
      prompts: prompts.length ? prompts : undefined,
    });
  }, [autoRunSeed, judgeModel, onRun, prompts, userModel]);

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-lg font-semibold text-white mb-1">Pipeline</h2>
        <p className="text-sm text-[var(--muted)] mb-4">
          Steps 1–2 use the existing files in <code className="text-white">benchmark/data/</code>. Step 3 saves the results as <code className="text-white">data/results-&lt;timestamp&gt;-&lt;id&gt;.json</code>.
        </p>

        <PipelineStepper phase={flowPhase === "complete" ? "complete" : flowPhase === "running" ? "running" : "idle"} />

        <div className="mb-6">
          <label className="block text-sm font-medium text-[var(--muted)] mb-1">
            AI Gateway API Key <span className="text-[var(--error)]">*</span>
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Passed to AI SDK for this run only (not saved)"
            className="w-full max-w-md rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Step 1 — read-only */}
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4 opacity-95">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--success)]">Ready</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">Step 1: Generate seeds</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Pre-generated scenario seeds are read from{" "}
              <code className="text-white">data/scenarioSeeds.jsonl</code>.
            </p>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              This step was generated by the default model{" "}
              <code className="text-white">gpt-5.2:high</code>.
            </p>
          </div>

          {/* Step 2 — read-only */}
          <div className="rounded-lg border border-[var(--border)] bg-black/20 p-4 opacity-95">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--success)]">Ready</span>
            </div>
            <h3 className="text-sm font-semibold text-white mb-2">Step 2: Expand scenarios</h3>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              Pre-expanded scenarios are read from{" "}
              <code className="text-white">data/scenarios.jsonl</code> (input for the benchmark run).
            </p>
            <p className="text-xs text-[var(--muted)] leading-relaxed">
              This step was generated by the default scenario expander model{" "}
              <code className="text-white">gpt-4o</code> and the defualt user model{" "}
              <code className="text-white">deepseek-v3.2</code>.
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
                modelList={modelList}
                required
                placeholder="gpt-4o"
                dropdownOnly
              />
              <ModelField
                label="Judge model"
                value={judgeModel}
                onChange={setJudgeModel}
                modelList={modelList}
                placeholder="gpt-5.2:high:limited"
                dropdownOnly
              />
              <ModelField
                label="User model"
                value={userModel}
                onChange={setUserModel}
                modelList={modelList}
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
            disabled={disabled || !apiKey.trim() || !targetModel.trim()}
            className="rounded-lg bg-[var(--accent)] px-6 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Run benchmark
          </button>
          {downloadHref && (
            <a
              href={downloadHref}
              download
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
            >
              Download last result
            </a>
          )}
        </div>
        {lastResultFile && (
          <p className="mt-2 text-xs text-[var(--muted)]">
            Saved as <code className="text-white">data/{lastResultFile}</code>
          </p>
        )}
      </section>
    </form>
  );
}
