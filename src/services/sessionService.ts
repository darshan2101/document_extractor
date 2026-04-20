import { Session } from "../db/models/Session.js";
import { Extraction } from "../db/models/Extraction.js";
import { Job } from "../db/models/Job.js";
import type { LLMFlag } from "../types/index.js";
import { parseJsonValue } from "../utils/parseJson.js";

const CRITICAL_DOCUMENT_TYPES = ["COC", "SIRB", "PASSPORT", "PEME"];

const getCriticalDocumentTypes = (): Set<string> => {
  return new Set(CRITICAL_DOCUMENT_TYPES.map(type => type.toUpperCase()));
};

const getTodayUtc = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};

const isWithin90Days = (expiryDateString: string | null): boolean => {
  if (!expiryDateString) return false;

  const expiryDate = new Date(expiryDateString);
  const today = getTodayUtc();

  // Calculate days until expiry
  const daysUntilExpiry = Math.ceil(
    (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );

  return daysUntilExpiry > 0 && daysUntilExpiry <= 90;
};

export interface DocumentSummary {
  id: string;
  fileName: string;
  documentType: string | null;
  applicableRole: string | null;
  holderName: string | null;
  confidence: string | null;
  isExpired: boolean;
  flagCount: number;
  criticalFlagCount: number;
  createdAt: string;
}

export interface PendingJob {
  jobId: string;
  status: string;
  queuedAt: string;
}

export interface SessionResponse {
  sessionId: string;
  documentCount: number;
  detectedRole: string | null;
  overallHealth: string;
  documents: DocumentSummary[];
  pendingJobs: PendingJob[];
}

export const sessionService = {
  async getSessionDetails(sessionId: string): Promise<SessionResponse | null> {
    // Fetch session
    const session = await Session.findByPk(sessionId);
    if (!session) {
      return null;
    }

    // Fetch all completed extractions, ordered by creation time
    const extractions = await Extraction.findAll({
      where: { sessionId },
      order: [["createdAt", "ASC"]]
    });

    // Fetch pending jobs (QUEUED or PROCESSING)
    const pendingJobs = await Job.findAll({
      where: {
        sessionId,
        status: ["QUEUED", "PROCESSING"]
      },
      order: [["queuedAt", "ASC"]]
    });

    // Derive detectedRole
    const detectedRole = deriveDetectedRole(extractions);

    // Derive overallHealth
    const overallHealth = deriveOverallHealth(extractions);

    // Map extractions to document summaries
    const documents: DocumentSummary[] = extractions.map(extraction => ({
      id: extraction.id,
      fileName: extraction.fileName,
      documentType: extraction.documentType,
      applicableRole: extraction.applicableRole,
      holderName: extraction.holderName,
      confidence: extraction.confidence,
      isExpired: extraction.isExpired,
      flagCount: parseJsonValue<LLMFlag[]>(extraction.flagsJson)?.length ?? 0,
      criticalFlagCount:
        parseJsonValue<LLMFlag[]>(extraction.flagsJson)?.filter(
          flag => flag.severity === "CRITICAL"
        ).length ?? 0,
      createdAt: extraction.createdAt.toISOString()
    }));

    // Map pending jobs
    const mappedPendingJobs: PendingJob[] = pendingJobs.map(job => ({
      jobId: job.id,
      status: job.status,
      queuedAt: job.queuedAt.toISOString()
    }));

    return {
      sessionId: session.id,
      documentCount: extractions.length,
      detectedRole,
      overallHealth,
      documents,
      pendingJobs: mappedPendingJobs
    };
  }
};

/**
 * Derive detectedRole from completed extractions.
 *
 * Logic:
 * - If all extractions agree on applicableRole, use that value
 * - If mixed roles, return "BOTH"
 * - If no extractions, return null
 */
function deriveDetectedRole(extractions: Extraction[]): string | null {
  if (extractions.length === 0) {
    return null;
  }

  const roles = new Set(
    extractions
      .map(e => e.applicableRole)
      .filter((role): role is string => role !== null && role !== undefined)
  );

  if (roles.size === 0) {
    return null;
  }

  if (roles.size === 1) {
    return Array.from(roles)[0];
  }

  return "BOTH";
}

/**
 * Derive overallHealth from completed extractions.
 *
 * CRITICAL if:
 *   - Any extraction has a flag with severity: "CRITICAL"
 *   - Any isExpired: true on a required certification (COC, SIRB, PASSPORT, PEME)
 *
 * WARN if:
 *   - Any extraction has isExpired: true (non-critical doc)
 *   - Any flag with severity: "HIGH" or "MEDIUM"
 *   - Any expiryDate within 90 days from today
 *
 * OK otherwise
 */
function deriveOverallHealth(extractions: Extraction[]): string {
  const criticalDocs = getCriticalDocumentTypes();

  for (const extraction of extractions) {
    // Check for critical flags
    const flags = parseJsonValue<LLMFlag[]>(extraction.flagsJson);
    if (flags && flags.some(flag => flag.severity === "CRITICAL")) {
      return "CRITICAL";
    }

    // Check for expired critical documents
    if (
      extraction.isExpired &&
      extraction.documentType &&
      criticalDocs.has(extraction.documentType.toUpperCase())
    ) {
      return "CRITICAL";
    }
  }

  // Check for warnings
  for (const extraction of extractions) {
    // Check for any expired document (non-critical)
    if (extraction.isExpired) {
      return "WARN";
    }

    // Check for high/medium severity flags
    const flags = parseJsonValue<LLMFlag[]>(extraction.flagsJson);
    if (
      flags &&
      flags.some(flag => flag.severity === "HIGH" || flag.severity === "MEDIUM")
    ) {
      return "WARN";
    }

    // Check for expiry within 90 days
    if (isWithin90Days(extraction.expiryDate)) {
      return "WARN";
    }
  }

  return "OK";
}
