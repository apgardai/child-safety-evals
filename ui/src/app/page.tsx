"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

const AGE_RANGES = ["7to9", "10to12", "13to17"];
const PROMPTS = ["default", "child"];

function ModelField({
  label,
  value,
  onChange,
  modelList,
  onFocus,
  required,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  modelList: string[];
  onFocus?: () => void;
  required?: boolean;
  placeholder?: string;
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
          onFocus={onFocus}
          className="shrink-0 w-[180px] rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
          aria-label={`${label} preset`}
        >
          <option value="">— Model List —</option>
          {modelList.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          required={required}
          placeholder={placeholder}
          className="min-w-0 max-w-[240px] flex-1 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
    </div>
  );
}

export default function Home() {
  const [output, setOutput] = useState("");
  const [running, setRunning] = useState(false);
  const [modelList, setModelList] = useState<string[]>([]);
  const [hasGatewayKey, setHasGatewayKey] = useState<boolean | null>(null);
  const [gatewayKeyInput, setGatewayKeyInput] = useState("");
  const [savingGatewayKey, setSavingGatewayKey] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/api/models")
      .then((r) => r.json())
      .then((data: { models?: string[] }) => setModelList(data.models ?? []))
      .catch(() => setModelList([]));
  }, []);

  useEffect(() => {
    fetch("/api/env")
      .then((r) => r.json())
      .then((data: { hasKey?: boolean }) =>
        setHasGatewayKey(typeof data.hasKey === "boolean" ? data.hasKey : false)
      )
      .catch(() => setHasGatewayKey(false));
  }, []);

  const saveGatewayKey = useCallback(async () => {
    setSavingGatewayKey(true);
    try {
      const res = await fetch("/api/env", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: gatewayKeyInput }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        hasKey?: boolean;
      };
      if (!res.ok) {
        setOutput(
          `Error ${res.status}: ${data.error ?? "Failed to save AI_GATEWAY_API_KEY"}`
        );
        return;
      }
      setHasGatewayKey(Boolean(data.hasKey));
      setGatewayKeyInput("");
      setOutput("Saved AI_GATEWAY_API_KEY to benchmark/.env");
    } finally {
      setSavingGatewayKey(false);
    }
  }, [gatewayKeyInput]);

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

  const runCommand = useCallback(async (body: object) => {
    abortRef.current = new AbortController();
    setRunning(true);
    setOutput("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const data = err as { error?: string; code?: string };
        const msg = data.code === "CLI_NOT_BUILT"
          ? `${data.error}\n\nUse the "Build benchmark" button below to build from the UI, or run in a terminal:\n  cd ../benchmark && yarn install && yarn tsbuild`
          : `Error ${res.status}: ${data.error ?? res.statusText}`;
        setOutput(msg);
        return;
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) {
        setOutput("No response body");
        return;
      }

      let text = "";
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
            Build benchmark → add AI Gateway API key
          </p>
          <p className="text-[var(--muted)] mt-1">
            Run benchmark pipeline: generate seeds → expand scenarios → run evaluations
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/models"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Models
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

      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white">AI Gateway API Key</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              Saves <code className="text-white">AI_GATEWAY_API_KEY</code> into{" "}
              <code className="text-white">child-safety-evals/benchmark/.env</code>.
            </p>
          </div>
          <div className="text-sm text-[var(--muted)]">
            Status:{" "}
            <span
              className={
                hasGatewayKey
                  ? "text-[var(--success)]"
                  : "text-[var(--warning)]"
              }
            >
              {hasGatewayKey === null
                ? "unknown"
                : hasGatewayKey
                  ? "set"
                  : "not set"}
            </span>
          </div>
        </div>

        <div className="mt-4 flex flex-col md:flex-row gap-2">
          <input
            type="password"
            value={gatewayKeyInput}
            onChange={(e) => setGatewayKeyInput(e.target.value)}
            placeholder="Paste API key (stored in benchmark/.env)"
            className="min-w-0 flex-1 rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
          />
          <button
            type="button"
            onClick={saveGatewayKey}
            disabled={
              savingGatewayKey || running || gatewayKeyInput.trim().length === 0
            }
            className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            Save key
          </button>
        </div>
      </section>

      <div className="grid gap-6 md:grid-cols-1">
        {/* Generate Seeds */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-white mb-3">
            Generate Seeds
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Generate scenario seeds from the risk taxonomy.
          </p>
          <GenerateSeedsForm
            onRun={runCommand}
            disabled={running}
            modelList={modelList}
          />
        </section>

        {/* Expand Scenarios */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-white mb-3">
            Expand Scenarios
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Transform seeds into full scenarios with validation.
          </p>
          <ExpandScenariosForm
            onRun={runCommand}
            disabled={running}
            modelList={modelList}
          />
        </section>

        {/* Run Benchmark */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-white mb-3">
            Run Benchmark
          </h2>
          <p className="text-sm text-[var(--muted)] mb-4">
            Run the benchmark against a target model.
          </p>
          <RunBenchmarkForm
            onRun={runCommand}
            disabled={running}
            modelList={modelList}
          />
        </section>
      </div>

      {/* Output */}
      <div className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 border-b border-[var(--border)] bg-black/30">
          <span className="text-sm font-medium text-[var(--muted)]">
            Output
          </span>
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
          {output || "Run a command to see output."}
        </pre>
      </div>
    </div>
  );
}

function GenerateSeedsForm({
  onRun,
  disabled,
  modelList,
}: {
  onRun: (body: object) => void;
  disabled: boolean;
  modelList: string[];
}) {
  const [model, setModel] = useState("gpt-4o");
  const [output, setOutput] = useState("data/scenarioSeeds.jsonl");
  const [seedsPerTask, setSeedsPerTask] = useState(8);
  const [ageRanges, setAgeRanges] = useState<string[]>(AGE_RANGES);

  const toggleAge = (r: string) => {
    setAgeRanges((prev) =>
      prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRun({
      command: "generate-seeds",
      model: model || undefined,
      output: output || undefined,
      seedsPerTask: seedsPerTask || undefined,
      ageRanges: ageRanges.length ? ageRanges : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ModelField
        label="Model"
        value={model}
        onChange={setModel}
        modelList={modelList}
        placeholder="gpt-4o"
      />
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1">
          Output path
        </label>
        <input
          type="text"
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1">
          Seeds per task
        </label>
        <input
          type="number"
          min={1}
          value={seedsPerTask}
          onChange={(e) => setSeedsPerTask(Number(e.target.value) || 8)}
          className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-2">
          Age ranges
        </label>
        <div className="flex flex-wrap gap-2">
          {AGE_RANGES.map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={ageRanges.includes(r)}
                onChange={() => toggleAge(r)}
                className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              <span className="text-sm text-white">{r}</span>
            </label>
          ))}
        </div>
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Generate seeds
      </button>
    </form>
  );
}

function ExpandScenariosForm({
  onRun,
  disabled,
  modelList,
}: {
  onRun: (body: object) => void;
  disabled: boolean;
  modelList: string[];
}) {
  const [model, setModel] = useState("gpt-5.2:high");
  const [userModel, setUserModel] = useState("deepseek-v3.2");
  const [input, setInput] = useState("data/scenarioSeeds.jsonl");
  const [output, setOutput] = useState("data/scenarios.jsonl");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRun({
      command: "expand-scenarios",
      model: model || undefined,
      userModel: userModel || undefined,
      input: input || undefined,
      output: output || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModelField
          label="Model"
          value={model}
          onChange={setModel}
          modelList={modelList}
          placeholder="gpt-5.2:high"
        />
        <ModelField
          label="User model"
          value={userModel}
          onChange={setUserModel}
          modelList={modelList}
          placeholder="deepseek-v3.2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1">
          Input (seeds JSONL)
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1">
          Output (scenarios JSONL)
        </label>
        <input
          type="text"
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Expand scenarios
      </button>
    </form>
  );
}

function RunBenchmarkForm({
  onRun,
  disabled,
  modelList,
}: {
  onRun: (body: object) => void;
  disabled: boolean;
  modelList: string[];
}) {
  const [targetModel, setTargetModel] = useState("gpt-4o");
  const [judgeModel, setJudgeModel] = useState("gpt-5.2:high:limited");
  const [userModel, setUserModel] = useState("deepseek-v3.2");
  const [input, setInput] = useState("data/scenarios.jsonl");
  const [output, setOutput] = useState("data/results.json");
  const [prompts, setPrompts] = useState<string[]>(["default"]);

  const togglePrompt = (p: string) => {
    setPrompts((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onRun({
      command: "run",
      targetModel: targetModel.trim(),
      judgeModel: judgeModel || undefined,
      userModel: userModel || undefined,
      input: input || undefined,
      output: output || undefined,
      prompts: prompts.length ? prompts : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ModelField
        label="Target model"
        value={targetModel}
        onChange={setTargetModel}
        modelList={modelList}
        required
        placeholder="gpt-4o"
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ModelField
          label="Judge model"
          value={judgeModel}
          onChange={setJudgeModel}
          modelList={modelList}
          placeholder="gpt-5.2:high:limited"
        />
        <ModelField
          label="User model"
          value={userModel}
          onChange={setUserModel}
          modelList={modelList}
          placeholder="deepseek-v3.2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1">
          Input (scenarios JSONL)
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-1">
          Output (results JSON)
        </label>
        <input
          type="text"
          value={output}
          onChange={(e) => setOutput(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-[var(--muted)] mb-2">
          Prompt variants
        </label>
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
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        Run benchmark
      </button>
    </form>
  );
}
