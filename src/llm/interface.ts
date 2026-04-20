import type { LLMExtractionResult } from "../types/index.js";

export interface ILLMProvider {
  extract(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string,
    hint?: string
  ): Promise<LLMExtractionResult>;
  repair(rawResponse: string): Promise<LLMExtractionResult>;
}
