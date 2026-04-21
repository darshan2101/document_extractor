import { GoogleGenerativeAI } from "@google/generative-ai";

import type { ILLMProvider } from "../interface.js";
import type { LLMExtractionResult } from "../../types/index.js";
import { repairJson } from "../../utils/jsonRepair.js";
import { EXTRACTION_PROMPT, REPAIR_PROMPT_PREFIX } from "./anthropic.js";

type RetryableError = Error & { retryable?: boolean };

const toRetryableError = (error: unknown): RetryableError => {
  if (error instanceof Error) {
    const typed = error as RetryableError;
    const combined = `${error.name} ${error.message}`.toLowerCase();

    if (
      combined.includes("timeout") ||
      combined.includes("timed out") ||
      combined.includes("abort") ||
      combined.includes("resource_exhausted") ||
      combined.includes("429")
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

export class GeminiProvider implements ILLMProvider {
  private readonly client: GoogleGenerativeAI;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.client = new GoogleGenerativeAI(apiKey);
  }

  async extract(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
    hint?: string
  ): Promise<LLMExtractionResult> {
    try {
      const prompt = hint ? `${EXTRACTION_PROMPT}\n\n${hint}` : EXTRACTION_PROMPT;
      const generativeModel = this.client.getGenerativeModel({ model: this.model });

      const filePart = {
        inlineData: {
          mimeType: mimeType as string,
          data: fileBuffer.toString("base64")
        }
      };

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      try {
        const result = await generativeModel.generateContent(
          [filePart, { text: prompt }],
          { signal: controller.signal }
        );

        const raw = result.response.text().trim();
        const parsed = repairJson(raw);

        if (!parsed) {
          throw new Error("LLM_JSON_PARSE_FAIL");
        }

        return toExtractionResult(parsed, raw);
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      throw toRetryableError(error);
    }
  }

  async repair(rawResponse: string): Promise<LLMExtractionResult> {
    try {
      const generativeModel = this.client.getGenerativeModel({ model: this.model });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      try {
        const result = await generativeModel.generateContent(
          [{ text: `${REPAIR_PROMPT_PREFIX}${rawResponse}` }],
          { signal: controller.signal }
        );

        const repairedRaw = result.response.text().trim();
        const parsed = repairJson(repairedRaw);

        if (!parsed) {
          throw new Error("LLM_JSON_PARSE_FAIL");
        }

        return toExtractionResult(parsed, rawResponse);
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      throw toRetryableError(error);
    }
  }

  async validate(prompt: string): Promise<string> {
    try {
      const generativeModel = this.client.getGenerativeModel({ model: this.model });

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);

      try {
        const result = await generativeModel.generateContent(
          [{ text: prompt }],
          { signal: controller.signal }
        );

        const raw = result.response.text().trim();
        const parsed = repairJson(raw);

        if (!parsed) {
          throw new Error("LLM_JSON_PARSE_FAIL");
        }

        return JSON.stringify(parsed);
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      throw toRetryableError(error);
    }
  }
}
