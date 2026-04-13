"use client";

import Link from "next/link";
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

export default function ModelsPage() {
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

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  return (
    <div className="min-h-screen p-6 md:p-10 max-w-6xl mx-auto">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Models</h1>
          <p className="text-[var(--muted)] mt-1">
            Manage <code className="text-white">models.json</code> registry entries for gateway models.
            To run a custom model, use{" "}
            <Link href="/benchmark" className="text-[var(--accent)] hover:underline">
              the benchmark pipeline
            </Link>{" "}
            and choose the custom target model.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/benchmark"
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
                placeholder="gpt-4o"
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
    </div>
  );
}
