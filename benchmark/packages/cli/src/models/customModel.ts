import {Scenario} from "@korabench/benchmark";
import {Model} from "./model.js";

const API_ENDPOINT = "https://api.openai.com/v1/responses";
const API_KEY_ENV_VAR = "APGARD_API_KEY";
const INCLUDE_SYSTEM_PROMPT = true;
const CUSTOM_SYSTEM_PROMPT = "";
const CUSTOM_TEMPERATURE: number | undefined = undefined;
const CUSTOM_MAX_TOKENS: number | undefined = undefined;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

export async function createCustomModel(
  _modelSlug: string,
  _scenario: Scenario
): Promise<Model> {
  const apiKey = process.env[API_KEY_ENV_VAR];
  if (!apiKey) {
    throw new Error(`Missing ${API_KEY_ENV_VAR} for custom model`);
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
            Authorization: `Bearer ${apiKey}`,
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
          throw new Error(`Custom model API error (${response.status}): ${errText}`);
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

    return `I am unable to answer right now due to upstream custom model connectivity issues (${lastError?.message ?? "unknown error"}).`;
  }

  return {
    async getTextResponse(request) {
      const parts = request.messages.map((m) => {
        if (!INCLUDE_SYSTEM_PROMPT && m.role === "system") return "";
        return `${m.role}: ${m.content}`;
      });
      const prompt = [CUSTOM_SYSTEM_PROMPT, parts.filter(Boolean).join("\n")]
        .filter(Boolean)
        .join("\n\n");
      return fetchCustom(prompt);
    },

    async getStructuredResponse(request) {
      const parts = request.messages.map((m) => {
        if (!INCLUDE_SYSTEM_PROMPT && m.role === "system") return "";
        return `${m.role}: ${m.content}`;
      });
      const prompt = [
        CUSTOM_SYSTEM_PROMPT,
        parts.filter(Boolean).join("\n"),
        "",
        "Return strictly valid JSON only.",
      ]
        .filter(Boolean)
        .join("\n");

      const rawText = await fetchCustom(prompt);
      try {
        return JSON.parse(rawText);
      } catch {
        throw new Error("Custom model structured response was not valid JSON");
      }
    },
  };
}
