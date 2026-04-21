import { env } from "../config/env.js";
import type { ILLMProvider } from "./interface.js";
import { AnthropicProvider } from "./providers/anthropic.js";
import { GroqProvider } from "./providers/groq.js";

export const getLLMProvider = (): ILLMProvider => {
  const { LLM_API_KEY: apiKey, LLM_MODEL: model, LLM_PROVIDER: provider } = env;

  if (provider === "anthropic") {
    return new AnthropicProvider(apiKey, model);
  }

  if (provider === "groq") {
    return new GroqProvider(apiKey, model);
  }

  throw new Error(`Unsupported LLM provider: ${provider}`);
};
