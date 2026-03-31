"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type ModelConfig = {
  model: string;
  maxTokens?: number;
  temperature?: number;
  providerOptions?: Record<string, Record<string, unknown>>;
};

type ModelRegistry = Record<string, ModelConfig>;

function tryParseJson<T>(raw: string): { ok: true; value: T } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(raw) as T };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

function formatJson(value: unknown): string {
  return JSON.stringify(value ?? {}, null, 2);
}

function buildCustomModelTs(params: {
  endpoint: string;
  includeSystemPrompt: boolean;
  systemPrompt: string;
  temperature?: number;
  maxTokens?: number;
}): string {
  const endpoint = JSON.stringify(params.endpoint);
  const includeSystemPrompt = params.includeSystemPrompt ? "true" : "false";
  const systemPrompt = JSON.stringify(params.systemPrompt);
  const temperature =
    params.temperature == null ? "undefined" : String(params.temperature);
  const maxTokens =
    params.maxTokens == null ? "undefined" : String(params.maxTokens);

  return `import {Scenario} from "@korabench/benchmark";
import {Model} from "./model.js";

const API_ENDPOINT = ${endpoint};
const API_KEY_ENV_VAR = "APGARD_API_KEY";
const INCLUDE_SYSTEM_PROMPT = ${includeSystemPrompt};
const CUSTOM_SYSTEM_PROMPT = ${systemPrompt};
const CUSTOM_TEMPERATURE: number | undefined = ${temperature};
const CUSTOM_MAX_TOKENS: number | undefined = ${maxTokens};
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

export async function createCustomModel(
  _modelSlug: string,
  _scenario: Scenario
): Promise<Model> {
  const apiKey = process.env[API_KEY_ENV_VAR];
  if (!apiKey) {
    throw new Error(\`Missing \${API_KEY_ENV_VAR} for custom model\`);
  }

  async function fetchCustom(prompt: string): Promise<string> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const response = await fetch(API_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: \`Bearer \${apiKey}\`,
          },
          body: JSON.stringify({
            message: prompt,
            ...(CUSTOM_TEMPERATURE != null ? {temperature: CUSTOM_TEMPERATURE} : {}),
            ...(CUSTOM_MAX_TOKENS != null ? {maxTokens: CUSTOM_MAX_TOKENS} : {}),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const errText = await response.text().catch(() => "");
          throw new Error(\`Custom model API error (\${response.status}): \${errText}\`);
        }

        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          const plain = await response.text();
          if (plain.trim()) return plain;
          throw new Error("Custom model API returned an empty non-JSON response");
        }

        const data = (await response.json()) as {
          response?: string;
          message?: string;
          output?: string;
          text?: string;
          data?: {response?: string; message?: string; output?: string; text?: string};
        };

        const text =
          data.response ??
          data.message ??
          data.output ??
          data.text ??
          data.data?.response ??
          data.data?.message ??
          data.data?.output ??
          data.data?.text;

        if (!text) {
          throw new Error("Custom model API returned no text content");
        }
        return text;
      } catch (err) {
        lastError = err as Error;
        if (attempt < MAX_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, attempt * 800));
          continue;
        }
      } finally {
        clearTimeout(timeout);
      }
    }

    return \`I am unable to answer right now due to upstream custom model connectivity issues (\${lastError?.message ?? "unknown error"}).\`;
  }

  return {
    async getTextResponse(request) {
      const parts = request.messages.map((m) => {
        if (!INCLUDE_SYSTEM_PROMPT && m.role === "system") return "";
        return \`\${m.role}: \${m.content}\`;
      });
      const prompt = [CUSTOM_SYSTEM_PROMPT, parts.filter(Boolean).join("\\n")]
        .filter(Boolean)
        .join("\\n\\n");
      return fetchCustom(prompt);
    },

    async getStructuredResponse(request) {
      const parts = request.messages.map((m) => {
        if (!INCLUDE_SYSTEM_PROMPT && m.role === "system") return "";
        return \`\${m.role}: \${m.content}\`;
      });
      const prompt = [
        CUSTOM_SYSTEM_PROMPT,
        parts.filter(Boolean).join("\\n"),
        "",
        "Return strictly valid JSON only.",
      ]
        .filter(Boolean)
        .join("\\n");

      const rawText = await fetchCustom(prompt);
      try {
        return JSON.parse(rawText);
      } catch {
        throw new Error("Custom model structured response was not valid JSON");
      }
    },
  };
}
`;
}

export default function ModelsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [registry, setRegistry] = useState<ModelRegistry>({});
  const [error, setError] = useState<string | null>(null);

  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [slug, setSlug] = useState("");
  const [model, setModel] = useState("");
  const [maxTokens, setMaxTokens] = useState<string>("");
  const [temperature, setTemperature] = useState<string>("");
  const [providerOptionsRaw, setProviderOptionsRaw] = useState<string>("{}");
  const [saving, setSaving] = useState(false);

  const [customModelLoading, setCustomModelLoading] = useState(true);
  const [customModelContent, setCustomModelContent] = useState("");
  const [customModelSaving, setCustomModelSaving] = useState(false);
  const [customBuildOutput, setCustomBuildOutput] = useState("");
  const [customEndpoint, setCustomEndpoint] = useState(
    "https://api.openai.com/v1/responses"
  );
  const [customApiKeyValue, setCustomApiKeyValue] = useState("");
  const [aiGatewayApiKeyValue, setAiGatewayApiKeyValue] = useState("");
  const [includeSystemPrompt, setIncludeSystemPrompt] = useState(true);
  const [customSystemPrompt, setCustomSystemPrompt] = useState("");
  const [customTemperature, setCustomTemperature] = useState<string>("");
  const [customMaxTokens, setCustomMaxTokens] = useState<string>("");

  const slugs = useMemo(() => Object.keys(registry).sort(), [registry]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/models");
      const data = (await res.json()) as { registry?: ModelRegistry; error?: string };
      setRegistry(data.registry ?? {});
      if (data.error) setError(data.error);
    } catch (e) {
      setError((e as Error).message);
      setRegistry({});
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshCustomModel = useCallback(async () => {
    setCustomModelLoading(true);
    try {
      const res = await fetch("/api/custom-model");
      const data = (await res.json()) as { content?: string; error?: string };
      setCustomModelContent(data.content ?? "");
      if (data.error) setError(data.error);
    } catch (e) {
      setError((e as Error).message);
      setCustomModelContent("");
    } finally {
      setCustomModelLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    void refreshCustomModel();
  }, [refresh, refreshCustomModel]);

  const startAdd = () => {
    setEditingSlug(null);
    setSlug("");
    setModel("");
    setMaxTokens("");
    setTemperature("");
    setProviderOptionsRaw("{}");
  };

  const startEdit = (s: string) => {
    const cfg = registry[s];
    setEditingSlug(s);
    setSlug(s);
    setModel(cfg?.model ?? "");
    setMaxTokens(cfg?.maxTokens != null ? String(cfg.maxTokens) : "");
    setTemperature(cfg?.temperature != null ? String(cfg.temperature) : "");
    setProviderOptionsRaw(formatJson(cfg?.providerOptions ?? {}));
  };

  const saveModel = async () => {
    setSaving(true);
    setError(null);
    try {
      const poParsed = providerOptionsRaw.trim().length
        ? tryParseJson<Record<string, Record<string, unknown>>>(providerOptionsRaw)
        : ({ ok: true, value: {} } as const);
      if (!poParsed.ok) {
        setError(`providerOptions JSON error: ${poParsed.error}`);
        return;
      }

      const config: ModelConfig = {
        model: model.trim(),
      };
      const mt = maxTokens.trim();
      if (mt) config.maxTokens = Number(mt);
      const temp = temperature.trim();
      if (temp) config.temperature = Number(temp);
      if (providerOptionsRaw.trim().length) config.providerOptions = poParsed.value;

      const res = await fetch("/api/models", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: slug.trim(), config }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Save failed: ${res.status}`);
        return;
      }
      await refresh();
      setEditingSlug(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteModel = async (s: string) => {
    if (!confirm(`Delete model "${s}" from models.json?`)) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/models", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: s }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Delete failed: ${res.status}`);
        return;
      }
      await refresh();
      if (editingSlug === s) startAdd();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const saveCustomModel = async () => {
    setCustomModelSaving(true);
    setError(null);
    setCustomBuildOutput("");
    try {
      const parsedTemperature = customTemperature.trim()
        ? Number(customTemperature.trim())
        : undefined;
      const parsedMaxTokens = customMaxTokens.trim()
        ? Number(customMaxTokens.trim())
        : undefined;
      const content = buildCustomModelTs({
        endpoint: customEndpoint.trim(),
        includeSystemPrompt,
        systemPrompt: customSystemPrompt.trim(),
        temperature: parsedTemperature,
        maxTokens: parsedMaxTokens,
      });
      const res = await fetch("/api/custom-model", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? `Save failed: ${res.status}`);
        return;
      }

      const buildRes = await fetch("/api/build/tsbuild", { method: "POST" });
      if (!buildRes.ok) {
        setError(`Failed to run tsbuild: ${buildRes.status}`);
        return;
      }
      const reader = buildRes.body?.getReader();
      const decoder = new TextDecoder();
      if (reader) {
        let text = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setCustomBuildOutput(text);
        }
      }
      await refreshCustomModel();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCustomModelSaving(false);
    }
  };

  const runWithCustomModel = () => {
    const customApiKey = customApiKeyValue.trim();
    const aiGatewayApiKey = aiGatewayApiKeyValue.trim();
    if (!customApiKey) {
      setError("Enter custom model API key to run benchmark (pass-through only).");
      return;
    }
    if (!aiGatewayApiKey) {
      setError("Enter AI Gateway API key to run benchmark (pass-through only).");
      return;
    }
    sessionStorage.setItem(
      "kora_custom_run_payload",
      JSON.stringify({
        customApiKey,
        aiGatewayApiKey,
      })
    );
    router.push("/?autorun=1&targetModel=custom-my-model");
  };

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Models</h1>
          <p className="text-[var(--muted)] mt-1">
            Manage <code className="text-white">models</code> and{" "}
            <code className="text-white">custom models</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)]"
          >
            Back
          </Link>
          <button
            type="button"
            onClick={() => void refresh()}
            disabled={loading || saving}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)] disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-lg border border-[var(--border)] bg-black/30 p-4 text-sm text-[var(--error)]">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Registry list */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="text-lg font-semibold text-white">models.json</h2>
            <button
              type="button"
              onClick={startAdd}
              className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Add model
            </button>
          </div>

          {loading ? (
            <div className="text-sm text-[var(--muted)]">Loading…</div>
          ) : slugs.length === 0 ? (
            <div className="text-sm text-[var(--muted)]">No models found.</div>
          ) : (
            <div className="space-y-2">
              {slugs.map((s) => (
                <div
                  key={s}
                  className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-black/20 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">{s}</div>
                    <div className="text-xs text-[var(--muted)] truncate">
                      {registry[s]?.model ?? ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(s)}
                      className="rounded-md px-3 py-1 text-sm text-white border border-[var(--border)] hover:bg-[var(--border)]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteModel(s)}
                      className="rounded-md px-3 py-1 text-sm text-[var(--error)] border border-[var(--border)] hover:bg-[var(--error)]/10"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Editor */}
        <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-lg font-semibold text-white mb-4">
            {editingSlug ? `Edit: ${editingSlug}` : "Add model"}
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                Slug (command-line name)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                placeholder="gpt-4o or custom-my-model"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Type in your slug here (e.g. <code className="text-white">gpt-4o</code>).
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                model <span className="text-[var(--error)]">*</span>
              </label>
              <input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
                placeholder="openai/gpt-4o"
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Provider/model identifier for the AI SDK gateway (e.g. <code className="text-white">openai/gpt-4o</code>).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                  maxTokens
                </label>
                <input
                  type="number"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
                  placeholder="4000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                  temperature
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white focus:border-[var(--accent)] focus:outline-none"
                  placeholder="0.5"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--muted)] mb-1">
                providerOptions (JSON)
              </label>
              <textarea
                value={providerOptionsRaw}
                onChange={(e) => setProviderOptionsRaw(e.target.value)}
                className="w-full min-h-[140px] rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white font-mono text-sm focus:border-[var(--accent)] focus:outline-none"
                spellCheck={false}
              />
              <p className="text-xs text-[var(--muted)] mt-1">
                Shape: <code className="text-white">{`{ \"openai\": { \"reasoningEffort\": \"high\" } }`}</code>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void saveModel()}
                disabled={saving || !slug.trim() || !model.trim()}
                className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                Save model
              </button>
              {editingSlug && (
                <button
                  type="button"
                  onClick={startAdd}
                  disabled={saving}
                  className="rounded-lg border border-[var(--border)] bg-black/20 px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)] disabled:opacity-50"
                >
                  New model
                </button>
              )}
            </div>
          </div>
        </section>
      </div>

      {/* Custom model editor */}
      <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-white">Custom Model Editor</h2>
            <p className="text-sm text-[var(--muted)] mt-1">
              Configure your custom model implementation
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void refreshCustomModel()}
              disabled={customModelLoading || customModelSaving}
              className="rounded-lg border border-[var(--border)] bg-black/20 px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)] disabled:opacity-50"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={() => void saveCustomModel()}
              disabled={
                customModelSaving ||
                !customEndpoint.trim()
              }
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              Generate & Save
            </button>
            <button
              type="button"
              onClick={runWithCustomModel}
              disabled={customModelSaving || !customApiKeyValue.trim()}
              className="rounded-lg border border-[var(--border)] bg-black/20 px-4 py-2 text-sm font-medium text-white hover:bg-[var(--border)] disabled:opacity-50"
            >
              Run benchmark
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              API endpoint <span className="text-[var(--error)]">*</span>
            </label>
            <input
              type="text"
              value={customEndpoint}
              onChange={(e) => setCustomEndpoint(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="https://api.openai.com/v1/responses"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              Custom model API key (passed through for this run)
            </label>
            <input
              type="password"
              value={customApiKeyValue}
              onChange={(e) => setCustomApiKeyValue(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Not saved to .env"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              AI Gateway API key (passed through for this run)
            </label>
            <input
              type="password"
              value={aiGatewayApiKeyValue}
              onChange={(e) => setAiGatewayApiKeyValue(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Not saved to .env"
            />
          </div>
          <div className="flex items-center pt-7">
            <label className="inline-flex items-center gap-2 text-sm text-white">
              <input
                type="checkbox"
                checked={includeSystemPrompt}
                onChange={(e) => setIncludeSystemPrompt(e.target.checked)}
                className="rounded border-[var(--border)] text-[var(--accent)] focus:ring-[var(--accent)]"
              />
              Include system prompts in requests
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              Temperature (optional)
            </label>
            <input
              type="number"
              step="0.1"
              value={customTemperature}
              onChange={(e) => setCustomTemperature(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="0.7"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              Max tokens (optional)
            </label>
            <input
              type="number"
              value={customMaxTokens}
              onChange={(e) => setCustomMaxTokens(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="1024"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-[var(--muted)] mb-1">
              System prompt text (optional)
            </label>
            <textarea
              value={customSystemPrompt}
              onChange={(e) => setCustomSystemPrompt(e.target.value)}
              className="w-full min-h-[100px] rounded-lg border border-[var(--border)] bg-black/30 px-3 py-2 text-white placeholder-[var(--muted)] focus:border-[var(--accent)] focus:outline-none"
              placeholder="Add an instruction prefix for every custom-model request."
            />
          </div>
        </div>

        <div className="mt-4 rounded-lg border border-[var(--border)] bg-black/20 p-3 text-xs text-[var(--muted)]">
          File status: {customModelLoading ? "Loading..." : customModelContent.trim() ? "Existing customModel.ts found" : "No customModel.ts found yet"}
        </div>

        {customBuildOutput && (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-black/20 p-3">
            <div className="text-xs text-[var(--muted)] mb-2">build output</div>
            <pre className="text-xs text-white whitespace-pre-wrap break-words max-h-56 overflow-auto">
              {customBuildOutput}
            </pre>
          </div>
        )}

        <p className="text-xs text-[var(--muted)] mt-2">
          After generating <code className="text-white">customModel.ts</code>, click <b>Build benchmark</b> on the home page
          so the compiled CLI picks up the changes.
        </p>
      </section>
    </div>
  );
}

