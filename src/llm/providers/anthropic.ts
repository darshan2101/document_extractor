import Anthropic from "@anthropic-ai/sdk";

import type { ILLMProvider } from "../interface.js";
import type { LLMExtractionResult } from "../../types/index.js";
import { repairJson } from "../../utils/jsonRepair.js";

export const PROMPT_VERSION = "v1";

export const EXTRACTION_PROMPT = `You are an expert maritime document analyst with deep knowledge of STCW, MARINA, IMO, and international seafarer certification standards.

A document has been provided. Perform the following in a single pass:
1. IDENTIFY the document type from the taxonomy below
2. DETERMINE if this belongs to a DECK officer, ENGINE officer, BOTH, or is role-agnostic (N/A)
3. EXTRACT all fields that are meaningful for this specific document type
4. FLAG any compliance issues, anomalies, or concerns

Document type taxonomy (use these exact codes):
COC | COP_BT | COP_PSCRB | COP_AFF | COP_MEFA | COP_MECA | COP_SSO | COP_SDSD |
ECDIS_GENERIC | ECDIS_TYPE | SIRB | PASSPORT | PEME | DRUG_TEST | YELLOW_FEVER |
ERM | MARPOL | SULPHUR_CAP | BALLAST_WATER | HATCH_COVER | BRM_SSBT |
TRAIN_TRAINER | HAZMAT | FLAG_STATE | OTHER

Return ONLY a valid JSON object. No markdown. No code fences. No preamble.

{
  "detection": {
    "documentType": "SHORT_CODE",
    "documentName": "Full human-readable document name",
    "category": "IDENTITY | CERTIFICATION | STCW_ENDORSEMENT | MEDICAL | TRAINING | FLAG_STATE | OTHER",
    "applicableRole": "DECK | ENGINE | BOTH | N/A",
    "isRequired": true,
    "confidence": "HIGH | MEDIUM | LOW",
    "detectionReason": "One sentence explaining how you identified this document"
  },
  "holder": {
    "fullName": "string or null",
    "dateOfBirth": "DD/MM/YYYY or null",
    "nationality": "string or null",
    "passportNumber": "string or null",
    "sirbNumber": "string or null",
    "rank": "string or null",
    "photo": "PRESENT | ABSENT"
  },
  "fields": [
    {
      "key": "snake_case_key",
      "label": "Human-readable label",
      "value": "extracted value as string",
      "importance": "CRITICAL | HIGH | MEDIUM | LOW",
      "status": "OK | EXPIRED | WARNING | MISSING | N/A"
    }
  ],
  "validity": {
    "dateOfIssue": "string or null",
    "dateOfExpiry": "string | 'No Expiry' | 'Lifetime' | null",
    "isExpired": false,
    "daysUntilExpiry": null,
    "revalidationRequired": null
  },
  "compliance": {
    "issuingAuthority": "string",
    "regulationReference": "e.g. STCW Reg VI/1 or null",
    "imoModelCourse": "e.g. IMO 1.22 or null",
    "recognizedAuthority": true,
    "limitations": "string or null"
  },
  "medicalData": {
    "fitnessResult": "FIT | UNFIT | N/A",
    "drugTestResult": "NEGATIVE | POSITIVE | N/A",
    "restrictions": "string or null",
    "specialNotes": "string or null",
    "expiryDate": "string or null"
  },
  "flags": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "message": "Description of issue or concern"
    }
  ],
  "summary": "Two-sentence plain English summary of what this document confirms about the holder."
}`;

const REPAIR_PROMPT_PREFIX =
  "The following is a malformed JSON response from a document extraction task. Return only the corrected, valid JSON object. No explanation, no markdown.\n\nRaw response: ";

type RetryableError = Error & { retryable?: boolean };

const getTextContent = (
  content: ReadonlyArray<{ type: string; text?: string }>
): string =>
  content
    .filter((block) => block.type === "text")
    .map((block) => block.text ?? "")
    .join("\n")
    .trim();

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

const toRetryableError = (error: unknown): RetryableError => {
  if (error instanceof Error) {
    const timeoutError = error as RetryableError;
    const combinedMessage = `${error.name} ${error.message}`.toLowerCase();

    if (
      combinedMessage.includes("timeout") ||
      combinedMessage.includes("timed out") ||
      combinedMessage.includes("abort")
    ) {
      timeoutError.retryable = true;
    }

    return timeoutError;
  }

  return new Error(String(error));
};

export class AnthropicProvider implements ILLMProvider {
  private readonly client: Anthropic;

  constructor(
    private readonly apiKey: string,
    private readonly model: string
  ) {
    this.client = new Anthropic({ apiKey: this.apiKey });
  }

  async extract(
    fileBuffer: Buffer,
    mimeType: string,
    fileName: string
  ): Promise<LLMExtractionResult> {
    try {
      const response = await this.client.messages.create(
        {
          model: this.model,
          max_tokens: 4096,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
                    data: fileBuffer.toString("base64")
                  }
                },
                {
                  type: "text",
                  text: EXTRACTION_PROMPT
                }
              ]
            }
          ]
        },
        {
          signal: AbortSignal.timeout(30000),
          timeout: 30000
        }
      );

      const raw = getTextContent(response.content);
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
      const response = await this.client.messages.create(
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
        {
          signal: AbortSignal.timeout(30000),
          timeout: 30000
        }
      );

      const repairedRaw = getTextContent(response.content);
      const parsed = repairJson(repairedRaw);

      if (!parsed) {
        throw new Error("LLM_JSON_PARSE_FAIL");
      }

      return toExtractionResult(parsed, rawResponse);
    } catch (error) {
      throw toRetryableError(error);
    }
  }
}
