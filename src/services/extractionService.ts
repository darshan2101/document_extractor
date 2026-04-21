import type { Express } from "express";

import { Extraction } from "../db/models/Extraction.js";
import { getLLMProvider } from "../llm/index.js";
import { PROMPT_VERSION } from "../llm/providers/anthropic.js";
import type {
  LLMExtractionResult,
  LLMField,
  LLMFlag,
  LLMCompliance,
  LLMMedicalData,
  LLMValidity
} from "../types/index.js";
import { hashFile } from "../utils/hashFile.js";
import { parseDateToUtc, getTodayUtc, daysUntilExpiry } from "../utils/dates.js";
import { parseJsonValue } from "../utils/parseJson.js";

type UploadedFile = Express.Multer.File;

export type ExtractionServiceError = Error & {
  extractionId: string | null;
  retryable?: boolean;
  raw?: string;
};

export type ExtractionResponse = {
  id: string;
  sessionId: string;
  fileName: string;
  fileHash: string;
  status: string;
  documentType: string | null;
  documentName: string | null;
  category: string | null;
  applicableRole: string | null;
  isRequired: boolean | null;
  detectionReason: string | null;
  confidence: string | null;
  holder: {
    fullName: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    passportNumber: string | null;
    sirbNumber: string | null;
    rank: string | null;
    photo: "PRESENT" | "ABSENT" | null;
  };
  fields: LLMField[];
  validity: LLMValidity | null;
  compliance: LLMCompliance | null;
  medicalData: LLMMedicalData | null;
  flags: LLMFlag[];
  summary: string | null;
  isExpired: boolean;
  expiryDate: string | null;
  processingTimeMs: number | null;
  promptVersion: string | null;
  raw: string | null;
  createdAt: Date;
};

type PersistedExtractionPayload = {
  sessionId: string;
  fileName: string;
  fileHash: string;
  documentType: string | null;
  documentName: string | null;
  category: string | null;
  applicableRole: string | null;
  isRequired: boolean | null;
  detectionReason: string | null;
  confidence: string | null;
  holderName: string | null;
  dateOfBirth: string | null;
  sirbNumber: string | null;
  passportNumber: string | null;
  rank: string | null;
  nationality: string | null;
  holderPhoto: "PRESENT" | "ABSENT" | null;
  fieldsJson: string | null;
  validityJson: string | null;
  complianceJson: string | null;
  medicalDataJson: string | null;
  flagsJson: string | null;
  isExpired: boolean;
  expiryDate: string | null;
  summary: string | null;
  rawLlmResponse: string | null;
  processingTimeMs: number;
  promptVersion: string;
  status: string;
};

const getDerivedValidity = (
  validity: LLMValidity
): { validity: LLMValidity; isExpired: boolean; expiryDate: string | null } => {
  const parsedExpiry = parseDateToUtc(validity.dateOfExpiry);
  const today = getTodayUtc();
  const derivedDaysUntilExpiry =
    parsedExpiry !== null ? daysUntilExpiry(parsedExpiry, today) : null;
  const isExpired = parsedExpiry !== null ? derivedDaysUntilExpiry !== null && derivedDaysUntilExpiry < 0 : false;

  return {
    validity: {
      ...validity,
      isExpired,
      daysUntilExpiry:
        validity.daysUntilExpiry !== null ? validity.daysUntilExpiry : derivedDaysUntilExpiry
    },
    isExpired,
    expiryDate:
      validity.dateOfExpiry && validity.dateOfExpiry !== "No Expiry" && validity.dateOfExpiry !== "Lifetime"
        ? validity.dateOfExpiry
        : null
  };
};

const toPersistencePayload = (
  result: LLMExtractionResult,
  sessionId: string,
  file: UploadedFile,
  processingTimeMs: number
): PersistedExtractionPayload => {
  const derivedValidity = getDerivedValidity(result.validity);

  return {
    sessionId,
    fileName: file.originalname,
    fileHash: hashFile(file.buffer),
    documentType: result.detection.documentType,
    documentName: result.detection.documentName,
    category: result.detection.category,
    applicableRole: result.detection.applicableRole,
    isRequired: result.detection.isRequired,
    detectionReason: result.detection.detectionReason,
    confidence: result.detection.confidence,
    holderName: result.holder.fullName,
    dateOfBirth: result.holder.dateOfBirth,
    sirbNumber: result.holder.sirbNumber,
    passportNumber: result.holder.passportNumber,
    rank: result.holder.rank,
    nationality: result.holder.nationality,
    holderPhoto: result.holder.photo ?? null,
    fieldsJson: JSON.stringify(result.fields),
    validityJson: JSON.stringify(derivedValidity.validity),
    complianceJson: JSON.stringify(result.compliance),
    medicalDataJson: JSON.stringify(result.medicalData),
    flagsJson: JSON.stringify(result.flags),
    isExpired: derivedValidity.isExpired,
    expiryDate: derivedValidity.expiryDate,
    summary: result.summary,
    rawLlmResponse: result.raw,
    processingTimeMs,
    promptVersion: PROMPT_VERSION,
    status: "COMPLETE"
  };
};

export const formatExtractionResponse = (
  extraction: Extraction
): ExtractionResponse => {
  const validity = parseJsonValue<LLMValidity>(extraction.validityJson);
  const medicalData = parseJsonValue<LLMMedicalData>(extraction.medicalDataJson);
  const compliance = parseJsonValue<LLMCompliance>(extraction.complianceJson);

  return {
    id: extraction.id,
    sessionId: extraction.sessionId,
    fileName: extraction.fileName,
    fileHash: extraction.fileHash,
    status: extraction.status,
    documentType: extraction.documentType,
    documentName: extraction.documentName,
    category: extraction.category,
    applicableRole: extraction.applicableRole,
    isRequired: extraction.isRequired,
    detectionReason: extraction.detectionReason,
    confidence: extraction.confidence,
    holder: {
      fullName: extraction.holderName,
      dateOfBirth: extraction.dateOfBirth,
      nationality: extraction.nationality,
      passportNumber: extraction.passportNumber,
      sirbNumber: extraction.sirbNumber,
      rank: extraction.rank,
      photo: extraction.holderPhoto
    },
    fields: parseJsonValue<LLMField[]>(extraction.fieldsJson) ?? [],
    validity,
    compliance,
    medicalData,
    flags: parseJsonValue<LLMFlag[]>(extraction.flagsJson) ?? [],
    summary: extraction.summary,
    isExpired: extraction.isExpired,
    expiryDate: extraction.expiryDate,
    processingTimeMs: extraction.processingTimeMs,
    promptVersion: extraction.promptVersion,
    raw: extraction.rawLlmResponse,
    createdAt: extraction.createdAt
  };
};

export const extractionService = {
  async runExtraction(
    file: UploadedFile,
    sessionId: string
  ): Promise<ExtractionResponse> {
    const provider = getLLMProvider();
    const startedAt = Date.now();
    let rawFailurePayload: string | null = null;

    try {
      let result = await provider.extract(file.buffer, file.mimetype, file.originalname);

      if (result.detection.confidence === "LOW") {
        try {
          const hintedResult = await provider.extract(
            file.buffer,
            file.mimetype,
            file.originalname,
            `Hint: File name is "${file.originalname}", MIME type is "${file.mimetype}". Use these as additional signals for document type detection.`
          );

          if (
            hintedResult.detection.confidence === "HIGH" ||
            (hintedResult.detection.confidence === "MEDIUM" &&
              result.detection.confidence === "LOW")
          ) {
            result = hintedResult;
          }
        } catch {
          // Keep the original low-confidence result if the retry attempt fails.
        }
      }

      const extraction = await (Extraction.create as (v: PersistedExtractionPayload) => Promise<Extraction>)(
        toPersistencePayload(result, sessionId, file, Date.now() - startedAt)
      );

      return formatExtractionResponse(extraction);
    } catch (error) {
      rawFailurePayload =
        error instanceof Error && "raw" in error && typeof error.raw === "string"
          ? error.raw
          : error instanceof Error
            ? error.message
            : String(error);

      const failedExtraction = await (Extraction.create as (v: PersistedExtractionPayload) => Promise<Extraction>)({
        sessionId,
        fileName: file.originalname,
        fileHash: hashFile(file.buffer),
        documentType: null,
        documentName: null,
        category: null,
        applicableRole: null,
        isRequired: null,
        detectionReason: null,
        confidence: null,
        holderName: null,
        dateOfBirth: null,
        sirbNumber: null,
        passportNumber: null,
        rank: null,
        nationality: null,
        holderPhoto: null,
        fieldsJson: null,
        validityJson: null,
        complianceJson: null,
        medicalDataJson: null,
        flagsJson: null,
        isExpired: false,
        expiryDate: null,
        summary: null,
        rawLlmResponse: rawFailurePayload,
        processingTimeMs: Date.now() - startedAt,
        promptVersion: PROMPT_VERSION,
        status: "FAILED"
      });

      const serviceError = (error instanceof Error
        ? error
        : new Error(String(error))) as ExtractionServiceError;
      serviceError.extractionId = failedExtraction.id;
      serviceError.raw = rawFailurePayload;

      throw serviceError;
    }
  }
};
