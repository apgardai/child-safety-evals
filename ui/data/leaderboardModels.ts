import type { BenchmarkId } from "data/benchmarks";

export type DocLink = { label: string; href: string };

/** Primary model capability category (normalized from vendor positioning). */
export const MODEL_TYPES = ["Text", "Multimodal", "Reasoning", "Agentic"] as const;
export type ModelType = (typeof MODEL_TYPES)[number];

export const MODEL_TYPE_LABELS: Record<ModelType, string> = {
  Text: "Text",
  Multimodal: "Multimodal",
  Reasoning: "Reasoning",
  Agentic: "Agentic",
};

export type LeaderboardRow = {
  provider: string;
  model: string;
  /** Known benchmark target slugs that should map to this leaderboard card. */
  benchmarkTargets?: string[];
  /**
   * If set, the model is only shown on these leaderboards.
   * If omitted, the model appears on every benchmark leaderboard.
   */
  benchmarkIds?: BenchmarkId[];
  releaseDate: string;
  type: ModelType;
  license: string;
  apiLinks: DocLink[];
  inferenceLinks?: DocLink[];
};

export function leaderboardRowVisibleOn(
  row: LeaderboardRow,
  benchmarkId: BenchmarkId
): boolean {
  if (!row.benchmarkIds || row.benchmarkIds.length === 0) return true;
  return row.benchmarkIds.includes(benchmarkId);
}

const ANTHROPIC_API: DocLink[] = [
  {
    label: "API overview — Claude API docs",
    href: "https://docs.anthropic.com/en/api/getting-started",
  },
];

const OPENAI_API: DocLink[] = [
  { label: "Models — OpenAI API", href: "https://platform.openai.com/docs/models" },
];

const GOOGLE_GEMINI_API: DocLink[] = [
  {
    label: "Models — Gemini API (Google AI for Developers)",
    href: "https://ai.google.dev/gemini-api/docs/models",
  },
];

const GOOGLE_AI_STUDIO: DocLink[] = [
  { label: "Google AI Studio", href: "https://aistudio.google.com/" },
];

export const mainLeaderboardModels: LeaderboardRow[] = [
  {
    provider: "OpenAI",
    model: "GPT 5.5",
    benchmarkTargets: [
      "gpt-5.5",
      "gpt-5.5:high",
      "gpt-5.5:high:limited",
      "gpt-5.5-high-limited",
      "gpt-5.5:medium",
      "gpt-5.5:low",
      "openai/gpt-5.5",
    ],
    releaseDate: "04/23/26",
    type: "Agentic",
    license: "Proprietary",
    apiLinks: OPENAI_API,
  },
  {
    provider: "OpenAI",
    model: "GPT 5.2",
    benchmarkTargets: [
      "gpt-5.2-chat-latest",
      "gpt-5.2",
      "openai/gpt-5.2",
      "gpt-5.2:high",
      "gpt-5.2:high:limited",
    ],
    benchmarkIds: ["wellbeing"],
    releaseDate: "12/11/25",
    type: "Reasoning",
    license: "Proprietary",
    apiLinks: OPENAI_API,
  },
  {
    provider: "OpenAI",
    model: "GPT 5.6 Terra",
    benchmarkTargets: [
      "gpt-5.6-terra:high",
      "gpt-5.6-terra",
      "gpt-5.6-terra-high",
      "openai/gpt-5.6-terra",
    ],
    benchmarkIds: ["csea"],
    releaseDate: "08/06/26",
    type: "Reasoning",
    license: "Proprietary",
    apiLinks: OPENAI_API,
  },
  {
    provider: "Anthropic",
    model: "Claude Opus 4.8",
    benchmarkTargets: [
      "claude-opus-4.8",
      "anthropic/claude-opus-4.8",
    ],
    releaseDate: "05/28/26",
    type: "Reasoning",
    license: "Proprietary",
    apiLinks: ANTHROPIC_API,
  },
  {
    provider: "Anthropic",
    model: "Claude Sonnet 4.6",
    benchmarkTargets: [
      "claude-sonnet-4.6",
      "claude-sonnet-4.6:limited",
      "anthropic/claude-sonnet-4.6",
    ],
    releaseDate: "02/17/26",
    type: "Multimodal",
    license: "Proprietary",
    apiLinks: ANTHROPIC_API,
  },
  {
    provider: "Google",
    model: "Gemini 3.1 Pro",
    benchmarkTargets: [
      "gemini-3.1-pro",
      "google/gemini-3.1-pro",
      "gemini-3.1-pro-preview",
    ],
    releaseDate: "02/19/26",
    type: "Multimodal",
    license: "Proprietary",
    apiLinks: GOOGLE_GEMINI_API,
    inferenceLinks: GOOGLE_AI_STUDIO,
  },
  {
    provider: "Google",
    model: "Gemini 3.5 Flash",
    benchmarkTargets: [
      "gemini-3.5-flash",
      "google/gemini-3.5-flash",
      "gemini-3.1-flash",
      "google/gemini-3.1-flash",
    ],
    releaseDate: "05/19/26",
    type: "Agentic",
    license: "Proprietary",
    apiLinks: GOOGLE_GEMINI_API,
    inferenceLinks: GOOGLE_AI_STUDIO,
  },
  {
    provider: "Meta",
    model: "Llama 4 Scout",
    benchmarkTargets: ["llama-4-scout", "meta/llama-4-scout"],
    releaseDate: "04/05/25",
    type: "Multimodal",
    license: "Open Source",
    apiLinks: [
      {
        label: "Llama-4-Scout-17B-16E-Instruct — Hugging Face",
        href: "https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct",
      },
    ],
  },
  {
    provider: "Meta",
    model: "Llama 4 Maverick",
    benchmarkTargets: ["llama-4-maverick", "meta/llama-4-maverick"],
    releaseDate: "04/05/25",
    type: "Multimodal",
    license: "Open Source",
    apiLinks: [
      {
        label: "Llama-4-Maverick-17B-128E-Instruct — Hugging Face",
        href: "https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct",
      },
    ],
  },
  {
    provider: "Mistral",
    model: "Mistral Large 3",
    benchmarkTargets: ["mistral-large-3", "mistral/mistral-large-3"],
    releaseDate: "12/02/25",
    type: "Multimodal",
    license: "Proprietary",
    apiLinks: [{ label: "Mistral API specs", href: "https://docs.mistral.ai/api/" }],
  },
  {
    provider: "Mistral",
    model: "Mistral Medium 3.5",
    benchmarkTargets: [
      "mistral-medium-3.5",
      "mistral-medium-3",
      "mistral/mistral-medium-3.5",
    ],
    releaseDate: "04/29/26",
    type: "Reasoning",
    license: "Proprietary",
    apiLinks: [{ label: "Mistral API specs", href: "https://docs.mistral.ai/api/" }],
  },
  {
    provider: "Moonshot AI",
    model: "Kimi K2.6",
    benchmarkTargets: ["kimi-k2.6", "moonshot/kimi-k2.6", "kimi-k2.5"],
    releaseDate: "04/21/26",
    type: "Agentic",
    license: "Open Source",
    apiLinks: [
      { label: "Kimi API docs", href: "https://platform.moonshot.cn/docs/intro" },
    ],
  },
  {
    provider: "xAI",
    model: "Grok 4.3",
    benchmarkTargets: ["grok-4.3", "xai/grok-4.3"],
    releaseDate: "04/30/26",
    type: "Reasoning",
    license: "Proprietary",
    apiLinks: [
      { label: "Models and pricing — xAI", href: "https://docs.x.ai/docs/models-and-pricing" },
    ],
  },
  {
    provider: "DeepSeek",
    model: "DeepSeek V4 Pro",
    benchmarkTargets: [
      "deepseek/deepseek-v4-pro",
      "deepseek-v4-pro",
      "deepseek-v4-pro-thinking:limited",
      "deepseek/deepseek-v4-pro-thinking",
    ],
    releaseDate: "04/24/26",
    type: "Reasoning",
    license: "Open Source",
    apiLinks: [{ label: "DeepSeek API", href: "https://api-docs.deepseek.com/" }],
  },
  {
    provider: "DeepSeek",
    model: "DeepSeek V4 Flash",
    benchmarkTargets: [
      "deepseek/deepseek-v4-flash",
      "deepseek-v4-flash",
    ],
    releaseDate: "04/24/26",
    type: "Agentic",
    license: "Open Source",
    apiLinks: [{ label: "DeepSeek API", href: "https://api-docs.deepseek.com/" }],
  },
  {
    provider: "Xiaomi",
    model: "MiMo V2.5",
    benchmarkTargets: ["mimo-v2.5", "xiaomi/mimo-v2.5", "xiaomi/mimo-v2.5-pro", "mimo-v2.5-pro"],
    releaseDate: "04/27/26",
    type: "Agentic",
    license: "Open Source",
    apiLinks: [{ label: "Xiaomi MiMo", href: "https://github.com/XiaomiMiMo" }],
  },
  {
    provider: "Alibaba",
    model: "Qwen 3.7 Max",
    benchmarkTargets: ["qwen3.7-max", "alibaba/qwen3.7-max"],
    releaseDate: "05/20/26",
    type: "Reasoning",
    license: "Open Source",
    apiLinks: [{ label: "Qwen API", href: "https://help.aliyun.com/zh/model-studio/" }],
  },
  {
    provider: "Z.ai",
    model: "GLM 5.1",
    benchmarkTargets: ["glm-5.1", "zai/glm-5.1"],
    releaseDate: "04/07/26",
    type: "Reasoning",
    license: "Open Source",
    apiLinks: [{ label: "Z.AI guides", href: "https://docs.z.ai/guides/overview" }],
  },
  {
    provider: "Nvidia",
    model: "Nemotron 3 Ultra",
    benchmarkTargets: [
      "nvidia/nemotron-3-ultra-550b-a55b",
      "nemotron-3-ultra-550b-a55b",
    ],
    releaseDate: "06/04/26",
    type: "Reasoning",
    license: "Open Source",
    apiLinks: [{ label: "Nvidia API", href: "https://docs.api.nvidia.com/" }],
  },
  {
    provider: "MiniMax",
    model: "MiniMax M2.5",
    benchmarkTargets: ["minimax/minimax-m2.5", "minimax-m2.5"],
    releaseDate: "02/12/26",
    type: "Agentic",
    license: "Proprietary",
    apiLinks: [{ label: "MiniMax API", href: "https://www.minimaxi.com/en/platform" }],
  },
];

/** Reserved for additional models not shown on the main leaderboard grid. */
export const otherLeaderboardModels: LeaderboardRow[] = [];
