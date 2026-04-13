export type DocLink = { label: string; href: string };

export type LeaderboardRow = {
  provider: string;
  model: string;
  date: string;
  size: string;
  license: string;
  apiLinks: DocLink[];
  inferenceLinks?: DocLink[];
  notes?: string;
};

export const mainLeaderboardModels: LeaderboardRow[] = [
  {
    provider: "Anthropic",
    model: "Claude Opus / Sonnet 4.6",
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
    date: "12/11/25",
    size: "Undisclosed (400k context)",
    license: "Proprietary",
    apiLinks: [
      { label: "Models — OpenAI API", href: "https://platform.openai.com/docs/models" },
    ],
    notes: "GPT 5.3 coming soon",
  },
  {
    provider: "Z.ai",
    model: "GLM 5",
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
    model: "Llama 4 Maverick / Scout",
    date: "04/05/25",
    size: "17B",
    license: "Open Source",
    apiLinks: [
      {
        label: "Llama-4-Maverick-17B-128E-Instruct — Hugging Face",
        href: "https://huggingface.co/meta-llama/Llama-4-Maverick-17B-128E-Instruct",
      },
      {
        label: "Llama-4-Scout-17B-16E-Instruct — Hugging Face",
        href: "https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct",
      },
    ],
  },
  {
    provider: "xAI",
    model: "Grok 4.1 Fast",
    date: "11/19/25",
    size: "Undisclosed (2m context)",
    license: "Proprietary",
    apiLinks: [
      { label: "Models and pricing — xAI", href: "https://docs.x.ai/docs/models-and-pricing" },
    ],
    notes: "Grok 4.2 releasing soon",
  },
  {
    provider: "Mistral",
    model: "Mistral Large 3",
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
