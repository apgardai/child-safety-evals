export type DocLink = { label: string; href: string };

export type LeaderboardRow = {
  provider: string;
  model: string;
  /** Known benchmark target slugs that should map to this leaderboard card. */
  benchmarkTargets?: string[];
  date: string;
  size: string;
  license: string;
  apiLinks: DocLink[];
  inferenceLinks?: DocLink[];
};

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
      "gpt-5.5:medium",
      "gpt-5.5:low",
      "openai/gpt-5.5",
    ],
    date: "—",
    size: "Undisclosed",
    license: "Proprietary",
    apiLinks: OPENAI_API,
  },
  {
    provider: "Anthropic",
    model: "Claude Opus 4",
    benchmarkTargets: [
      "claude-opus-4",
      "claude-opus-4.7",
      "claude-opus-4.7:limited",
    ],
    date: "—",
    size: "Undisclosed (200k–1m context)",
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
    date: "02/17/26",
    size: "Undisclosed (200k–1m context)",
    license: "Proprietary",
    apiLinks: ANTHROPIC_API,
  },
  {
    provider: "Anthropic",
    model: "Claude Haiku 4.5",
    benchmarkTargets: [
      "claude-haiku-4.5",
      "claude-haiku-4.5:limited",
      "claude-haiku-4.5-high",
      "anthropic/claude-haiku-4.5",
    ],
    date: "—",
    size: "Undisclosed (200k context)",
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
    date: "02/19/26",
    size: "Undisclosed (1m context)",
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
    date: "—",
    size: "Undisclosed (1m context)",
    license: "Proprietary",
    apiLinks: GOOGLE_GEMINI_API,
    inferenceLinks: GOOGLE_AI_STUDIO,
  },
  {
    provider: "Google",
    model: "Nano Banana 2",
    benchmarkTargets: [
      "gemini-3.1-flash-image",
      "gemini-3.1-flash-image-preview",
      "google/gemini-3.1-flash-image",
      "nano-banana-2",
    ],
    date: "02/26/26",
    size: "Undisclosed (image generation)",
    license: "Proprietary",
    apiLinks: [
      {
        label: "Nano Banana 2 — Google blog",
        href: "https://blog.google/innovation-and-ai/technology/ai/nano-banana-2/",
      },
      ...GOOGLE_GEMINI_API,
    ],
    inferenceLinks: [
      {
        label: "Gemini 3.1 Flash Image — AI Studio",
        href: "https://aistudio.google.com/models/gemini-3-1-flash-image",
      },
    ],
  },
  {
    provider: "Meta",
    model: "Llama 4 Scout",
    benchmarkTargets: ["llama-4-scout", "meta/llama-4-scout"],
    date: "04/05/25",
    size: "17B (16E)",
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
    date: "04/05/25",
    size: "17B (128E)",
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
    date: "12/02/25",
    size: "675B",
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
    date: "—",
    size: "Undisclosed",
    license: "Proprietary",
    apiLinks: [{ label: "Mistral API specs", href: "https://docs.mistral.ai/api/" }],
  },
  {
    provider: "Mistral",
    model: "Mistral Small 4",
    benchmarkTargets: ["mistral-small-4", "mistral-small", "mistral/mistral-small-4"],
    date: "—",
    size: "Undisclosed",
    license: "Proprietary",
    apiLinks: [{ label: "Mistral API specs", href: "https://docs.mistral.ai/api/" }],
  },
  {
    provider: "Moonshot AI",
    model: "Kimi K2.6",
    benchmarkTargets: ["kimi-k2.6", "moonshot/kimi-k2.6", "kimi-k2.5"],
    date: "—",
    size: "Undisclosed",
    license: "Open Source",
    apiLinks: [
      { label: "Kimi API docs", href: "https://platform.moonshot.cn/docs/intro" },
    ],
  },
  {
    provider: "xAI",
    model: "Grok 4.3",
    benchmarkTargets: ["grok-4.3", "xai/grok-4.3"],
    date: "04/30/26",
    size: "Undisclosed (1M context)",
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
    date: "—",
    size: "Undisclosed",
    license: "Open Source",
    apiLinks: [{ label: "DeepSeek API", href: "https://api-docs.deepseek.com/" }],
  },
  {
    provider: "Xiaomi",
    model: "MiMo V2.5 Pro",
    benchmarkTargets: ["xiaomi/mimo-v2.5-pro", "mimo-v2.5-pro"],
    date: "—",
    size: "Undisclosed",
    license: "Open Source",
    apiLinks: [{ label: "Xiaomi MiMo", href: "https://github.com/XiaomiMiMo" }],
  },
  {
    provider: "Alibaba",
    model: "Qwen3.6 27B",
    benchmarkTargets: ["alibaba/qwen3.6-27b", "qwen3.6-27b"],
    date: "—",
    size: "27B",
    license: "Open Source",
    apiLinks: [{ label: "Qwen API", href: "https://help.aliyun.com/zh/model-studio/" }],
  },
  {
    provider: "Z.ai",
    model: "GLM-5V Turbo",
    benchmarkTargets: ["zai/glm-5v-turbo", "glm-5v-turbo", "glm-5", "zai/glm-5"],
    date: "—",
    size: "Undisclosed",
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
    date: "—",
    size: "550B (55B active)",
    license: "Open Source",
    apiLinks: [{ label: "Nvidia API", href: "https://docs.api.nvidia.com/" }],
  },
  {
    provider: "MiniMax",
    model: "MiniMax M2.5",
    benchmarkTargets: ["minimax/minimax-m2.5", "minimax-m2.5"],
    date: "—",
    size: "Undisclosed",
    license: "Proprietary",
    apiLinks: [{ label: "MiniMax API", href: "https://www.minimaxi.com/en/platform" }],
  },
];

/** Reserved for additional models not shown on the main leaderboard grid. */
export const otherLeaderboardModels: LeaderboardRow[] = [];
