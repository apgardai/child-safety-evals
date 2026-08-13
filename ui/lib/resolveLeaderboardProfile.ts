import {
  mainLeaderboardModels,
  otherLeaderboardModels,
  type LeaderboardRow,
} from "data/leaderboardModels";
import { humanizeSlug } from "lib/humanizeSlug";

const allRows: LeaderboardRow[] = [
  ...mainLeaderboardModels,
  ...otherLeaderboardModels,
];

function byBenchmarkTarget(slug: string): LeaderboardRow | undefined {
  const s = slug.trim().toLowerCase();
  return allRows.find((r) =>
    (r.benchmarkTargets ?? []).some((t) => t.toLowerCase() === s)
  );
}

/**
 * Best-effort match from benchmark `models.json` / results `target` slug to a curated leaderboard row.
 */
export function resolveLeaderboardRowForTarget(
  target: string | undefined
): LeaderboardRow | null {
  const s = (target ?? "").trim().toLowerCase();
  if (!s) return null;

  for (const row of allRows) {
    const targets = row.benchmarkTargets ?? [];
    if (targets.some((t) => s === t.toLowerCase())) {
      return row;
    }
  }

  const rules: Array<{ match: (slug: string) => boolean; slug: string }> = [
    {
      match: (slug) => slug.includes("nemotron"),
      slug: "nvidia/nemotron-3-ultra-550b-a55b",
    },
    {
      match: (slug) => slug.includes("minimax"),
      slug: "minimax/minimax-m2.5",
    },
    {
      match: (slug) => slug.includes("mimo"),
      slug: "xiaomi/mimo-v2.5",
    },
    {
      match: (slug) => slug.includes("qwen3.7") || slug.includes("qwen-3.7"),
      slug: "qwen3.7-max",
    },
    {
      match: (slug) => slug.includes("qwen"),
      slug: "qwen3.7-max",
    },
    {
      match: (slug) => slug.includes("glm-5.1") || slug.includes("glm5.1"),
      slug: "glm-5.1",
    },
    {
      match: (slug) => slug.includes("glm"),
      slug: "glm-5.1",
    },
    {
      match: (slug) => slug.includes("deepseek") && slug.includes("flash"),
      slug: "deepseek-v4-flash",
    },
    {
      match: (slug) => slug.includes("deepseek"),
      slug: "deepseek/deepseek-v4-pro",
    },
    {
      match: (slug) => slug.includes("grok"),
      slug: "xai/grok-4.3",
    },
    {
      match: (slug) => slug.includes("kimi"),
      slug: "kimi-k2.6",
    },
    {
      match: (slug) =>
        slug.includes("mistral") &&
        (slug.includes("medium") || slug.includes("3.5")),
      slug: "mistral-medium-3.5",
    },
    {
      match: (slug) => slug.includes("mistral") || slug.includes("ministral"),
      slug: "mistral-large-3",
    },
    {
      match: (slug) => slug.includes("gemini") && slug.includes("3.5"),
      slug: "gemini-3.5-flash",
    },
    {
      match: (slug) =>
        slug.includes("gemini") &&
        slug.includes("3.1") &&
        slug.includes("pro"),
      slug: "gemini-3.1-pro",
    },
    {
      match: (slug) => slug.includes("gemini"),
      slug: "gemini-3.1-pro",
    },
    {
      match: (slug) => slug.includes("sonnet"),
      slug: "claude-sonnet-4.6",
    },
    {
      match: (slug) => slug.includes("opus") || slug.includes("anthropic-claude-opus"),
      slug: "claude-opus-4.8",
    },
    {
      match: (slug) => slug.includes("claude") || slug.includes("anthropic/"),
      slug: "claude-opus-4.8",
    },
    {
      match: (slug) =>
        slug.includes("llama-4-scout") ||
        (slug.includes("llama") && slug.includes("scout")),
      slug: "llama-4-scout",
    },
    {
      match: (slug) =>
        slug.includes("llama-4-maverick") ||
        (slug.includes("llama") && slug.includes("maverick")),
      slug: "llama-4-maverick",
    },
    {
      match: (slug) =>
        slug.includes("llama") || slug.includes("meta-llama") || slug.includes("meta/"),
      slug: "llama-4-scout",
    },
    {
      match: (slug) =>
        slug.includes("gpt-5.6-terra") || slug.includes("gpt-5.6"),
      slug: "gpt-5.6-terra:high",
    },
    {
      match: (slug) => slug.includes("gpt-5.5") || slug.startsWith("gpt-5.5"),
      slug: "gpt-5.5",
    },
    {
      match: (slug) =>
        slug.includes("gpt-5.2") ||
        slug.includes("gpt-5.2-chat") ||
        slug.includes("chatgpt"),
      slug: "gpt-5.2-chat-latest",
    },
    {
      match: (slug) =>
        slug.includes("gpt") ||
        slug.includes("openai/") ||
        /^o\d/i.test(slug),
      slug: "gpt-5.5",
    },
  ];

  for (const { match, slug } of rules) {
    if (match(s)) {
      const row = byBenchmarkTarget(slug);
      if (row) return row;
    }
  }
  return null;
}

/** User-facing model title; prefers curated leaderboard names over raw benchmark slugs. */
export function displayModelLabel(slug: string | undefined): string {
  const s = (slug ?? "").trim();
  if (!s) return "—";
  const profile = resolveLeaderboardRowForTarget(s);
  if (profile?.model) return profile.model;
  const slugHead = s.split(/[:]/)[0]?.trim() ?? s;
  return slugHead ? humanizeSlug(slugHead) : "Unknown target";
}
