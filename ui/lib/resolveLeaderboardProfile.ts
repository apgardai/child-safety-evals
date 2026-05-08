import {
  mainLeaderboardModels,
  otherLeaderboardModels,
  type LeaderboardRow,
} from "data/leaderboardModels";

const allRows: LeaderboardRow[] = [
  ...mainLeaderboardModels,
  ...otherLeaderboardModels,
];

function byProvider(name: string): LeaderboardRow | undefined {
  return allRows.find((r) => r.provider === name);
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
    if (targets.some(t => s === t.toLowerCase())) {
      return row;
    }
  }

  const rules: Array<{ match: (slug: string) => boolean; row?: LeaderboardRow }> = [
    { match: slug => slug.includes("deepseek"), row: byProvider("DeepSeek") },
    { match: slug => slug.includes("claude"), row: byProvider("Anthropic") },
    { match: slug => slug.includes("kimi"), row: byProvider("Moonshot AI") },
    { match: slug => slug.includes("glm"), row: byProvider("Z.ai") },
    { match: slug => slug.includes("gemini"), row: byProvider("Google") },
    { match: slug => slug.includes("grok"), row: byProvider("xAI") },
    { match: slug => slug.includes("mistral") || slug.includes("ministral"), row: byProvider("Mistral") },
    { match: slug => slug.includes("qwen"), row: byProvider("Alibaba") },
    { match: slug => slug.includes("nemotron"), row: byProvider("Nvidia") },
    {
      match: slug =>
        slug.includes("llama") || slug.includes("meta-llama") || slug.includes("meta/"),
      row: byProvider("Meta"),
    },
    {
      match: slug =>
        slug.includes("gpt") ||
        slug.includes("openai/") ||
        /^o\d/i.test(slug) ||
        slug.includes("chatgpt"),
      row: byProvider("OpenAI"),
    },
  ];

  for (const { match, row } of rules) {
    if (row && match(s)) return row;
  }
  return null;
}
