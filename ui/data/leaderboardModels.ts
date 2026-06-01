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

export const mainLeaderboardModels: LeaderboardRow[] = [
  {
    provider: "Anthropic",
    model: "Claude Opus / Sonnet 4.6",
    benchmarkTargets: ["claude-opus-4.6", "claude-sonnet-4.6"],
    date: "02/05/26 / 02/17/26",
    size: "Undisclosed (200k–1m context)",
    license: "Proprietary",
    apiLinks: [
      {
        label: "API overview — Claude API docs",
        href: "https://docs.anthropic.com/en/api/getting-started",
      },
    ],
  },
  {
    provider: "OpenAI",
    model: "GPT 5.2",
    benchmarkTargets: ["gpt-5.2", "gpt-5.2:high", "gpt-5.2:high:limited"],
    date: "12/11/25",
    size: "Undisclosed (400k context)",
    license: "Proprietary",
    apiLinks: [
      { label: "Models — OpenAI API", href: "https://platform.openai.com/docs/models" },
    ],
  },
  {
    provider: "OpenAI",
    model: "GPT-4o",
    benchmarkTargets: ["gpt-4o", "gpt-4o-mini"],
    date: "05/13/24",
    size: "Undisclosed (128k context)",
    license: "Proprietary",
    apiLinks: [
      { label: "Models — OpenAI API", href: "https://platform.openai.com/docs/models" },
    ],
  },
  {
    provider: "Z.ai",
    model: "GLM 5",
    benchmarkTargets: ["glm-5"],
    date: "02/12/26",
    size: "745B (200k context)",
    license: "Open Source",
    apiLinks: [{ label: "Z.AI guides", href: "https://docs.z.ai/guides/overview" }],
    inferenceLinks: [
      {
        label: "zai-org/GLM-5 — Hugging Face",
        href: "https://huggingface.co/zai-org/GLM-5",
      },
    ],
  },
  {
    provider: "Moonshot AI",
    model: "Kimi K2.5",
    benchmarkTargets: ["kimi-k2.5"],
    date: "01/26/26",
    size: "1T",
    license: "Open Source",
    apiLinks: [
      { label: "Kimi API docs", href: "https://platform.moonshot.cn/docs/intro" },
    ],
    inferenceLinks: [
      {
        label: "moonshotai/Kimi-K2.5 — Hugging Face",
        href: "https://huggingface.co/moonshotai/Kimi-K2.5",
      },
    ],
  },
  {
    provider: "Google",
    model: "Gemini 3.1 Pro / Flash",
    benchmarkTargets: ["gemini-3.1-pro", "gemini-3.1-flash"],
    date: "02/19/26",
    size: "Undisclosed (1m context)",
    license: "Proprietary",
    apiLinks: [
      {
        label: "Models — Gemini API (Google AI for Developers)",
        href: "https://ai.google.dev/gemini-api/docs/models",
      },
    ],
    inferenceLinks: [
      { label: "Google AI Studio", href: "https://aistudio.google.com/" },
    ],
  },
  {
    provider: "Meta",
    model: "Llama 4 Maverick",
    benchmarkTargets: ["llama-4-maverick"],
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
    provider: "Meta",
    model: "Llama 4 Scout",
    benchmarkTargets: ["llama-4-scout"],
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
    provider: "xAI",
    model: "Grok 4.1 Fast",
    benchmarkTargets: ["grok-4.1-fast"],
    date: "11/19/25",
    size: "Undisclosed (2m context)",
    license: "Proprietary",
    apiLinks: [
      { label: "Models and pricing — xAI", href: "https://docs.x.ai/docs/models-and-pricing" },
    ],
  },
  {
    provider: "xAI",
    model: "Grok 4.3",
    benchmarkTargets: ["grok-4.3"],
    date: "04/30/26",
    size: "Undisclosed (1M context)",
    license: "Proprietary",
    apiLinks: [
      { label: "Models and pricing — xAI", href: "https://docs.x.ai/docs/models-and-pricing" },
    ],
  },
  {
    provider: "Mistral",
    model: "Mistral Large 3",
    benchmarkTargets: ["mistral-large-3"],
    date: "12/02/25",
    size: "675B",
    license: "Proprietary",
    apiLinks: [
      { label: "Mistral API specs", href: "https://docs.mistral.ai/api/" },
    ],
  },
  {
    provider: "DeepSeek",
    model: "DeepSeek-V3.2",
    benchmarkTargets: ["deepseek-v3.2"],
    date: "12/01/25",
    size: "685B",
    license: "Open Source",
    apiLinks: [{ label: "DeepSeek API", href: "https://api-docs.deepseek.com/" }],
    inferenceLinks: [
      {
        label: "deepseek-ai/DeepSeek-V3.2 — Hugging Face",
        href: "https://huggingface.co/deepseek-ai/DeepSeek-V3.2",
      },
    ],
  },
];

export const otherLeaderboardModels: LeaderboardRow[] = [
  {
    provider: "Alibaba",
    model: "Qwen3.5-397B-A17B",
    benchmarkTargets: ["qwen3.5-397b-a17b"],
    date: "02/16/26",
    size: "397B",
    license: "Open Source",
    apiLinks: [{ label: "Qwen API", href: "https://help.aliyun.com/zh/model-studio/" }],
    inferenceLinks: [
      {
        label: "Qwen/Qwen3.5-397B-A17B — Hugging Face",
        href: "https://huggingface.co/Qwen/Qwen3.5-397B-A17B",
      },
    ],
  },
  {
    provider: "Nvidia",
    model: "Nemotron-3-Nano-30B-A3B",
    benchmarkTargets: ["nemotron-3-nano-30b-a3b"],
    date: "9/2025–10/2025",
    size: "30B",
    license: "Open Source",
    apiLinks: [{ label: "Nvidia API", href: "https://docs.api.nvidia.com/" }],
    inferenceLinks: [
      {
        label: "nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16 — Hugging Face",
        href: "https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B-BF16",
      },
    ],
  },
];
