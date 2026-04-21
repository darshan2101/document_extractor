import Groq from "groq-sdk";

import type { ILLMProvider } from "../interface.js";
import type { LLMExtractionResult } from "../../types/index.js";
import { repairJson } from "../../utils/jsonRepair.js";
import { EXTRACTION_PROMPT, PROMPT_VERSION, REPAIR_PROMPT_PREFIX } from "./anthropic.js";

export { PROMPT_VERSION };

type RetryableError = Error & { retryable?: boolean };

const toRetryableError = (error: unknown): RetryableError => {
  if (error instanceof Error) {
    const typed = error as RetryableError;
    const combined = `${error.name} ${error.message}`.toLowerCase();

    if (
      combined.includes("timeout") ||
      combined.includes("timed out") ||
      combined.includes("abort") ||
      combined.includes("rate_limit")
    ) {
      typed.retryable = true;
    }

    return typed;
  }

  return new Error(String(error));
};

const toExtractionResult = (
  parsed: Record<string, unknown>,
  raw: string
): LLMExtractionResult => {
  if (!("detection" in parsed)) {
    throw new Error("LLM_JSON_PARSE_FAIL");
  }

  return {
    ...(parsed as Omit<LLMExtractionResult, "raw">),
    raw
  };
};

export class GroqProvider implements ILLMProvider {
  private readonly client: Groq;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.client = new Groq({ apiKey });
  }

  async extract(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
    hint?: string
  ): Promise<LLMExtractionResult> {
    if (mimeType === "application/pdf") {
      throw Object.assign(
        new Error("Groq vision models do not support PDF input. Upload an image (JPEG, PNG, WEBP) instead."),
        { retryable: false }
      );
    }

    try {
      const prompt = hint ? `${EXTRACTION_PROMPT}\n\n${hint}` : EXTRACTION_PROMPT;
      const dataUri = `data:${mimeType};base64,${fileBuffer.toString("base64")}`;

      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image_url",
                  image_url: { url: dataUri }
                },
                {
                  type: "text",
                  text: prompt
                }
              ]
            }
          ]
        },
        { signal: AbortSignal.timeout(30000) }
      );

      const raw = response.choices[0]?.message?.content?.trim() ?? "";
      const parsed = repairJson(raw);

      if (!parsed) {
        throw new Error("LLM_JSON_PARSE_FAIL");
      }

      return toExtractionResult(parsed, raw);
    } catch (error) {
      throw toRetryableError(error);
    }
  }

  async repair(rawResponse: string): Promise<LLMExtractionResult> {
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: `${REPAIR_PROMPT_PREFIX}${rawResponse}`
            }
          ]
        },
        { signal: AbortSignal.timeout(30000) }
      );

      const repairedRaw = response.choices[0]?.message?.content?.trim() ?? "";
      const parsed = repairJson(repairedRaw);

      if (!parsed) {
        throw new Error("LLM_JSON_PARSE_FAIL");
      }

      return toExtractionResult(parsed, rawResponse);
    } catch (error) {
      throw toRetryableError(error);
    }
  }

  async validate(prompt: string): Promise<string> {
    try {
      const response = await this.client.chat.completions.create(
        {
          model: this.model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: prompt
            }
          ]
        },
        { signal: AbortSignal.timeout(30000) }
      );

      const raw = response.choices[0]?.message?.content?.trim() ?? "";
      const parsed = repairJson(raw);

      if (!parsed) {
        throw new Error("LLM_JSON_PARSE_FAIL");
      }

      return JSON.stringify(parsed);
    } catch (error) {
      throw toRetryableError(error);
    }
  }
}
