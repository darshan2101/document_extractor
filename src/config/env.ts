import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  PORT: z
    .string()
    .trim()
    .optional()
    .transform((value) => {
      if (!value) {
        return 3000;
      }

      const parsed = Number(value);
      if (!Number.isInteger(parsed) || parsed <= 0) {
        throw new Error("PORT must be a positive integer.");
      }

      return parsed;
    }),
  NODE_ENV: z.enum(["development", "test", "production"]),
  DATABASE_URL: z
    .string()
    .trim()
    .optional()
    .transform((value) => value || "./dev.sqlite"),
  REDIS_URL: z.string().trim().min(1, "REDIS_URL is required."),
  LLM_PROVIDER: z.enum(["anthropic", "groq", "mistral", "openai"]),
  LLM_MODEL: z.string().trim().min(1, "LLM_MODEL is required."),
  LLM_API_KEY: z.string().trim().min(1, "LLM_API_KEY is required.")
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
    .join("; ");

  throw new Error(`Invalid environment configuration: ${issues}`);
}

export const env = parsedEnv.data;
