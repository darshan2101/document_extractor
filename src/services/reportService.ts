import { Session } from "../db/models/Session.js";
import { Extraction } from "../db/models/Extraction.js";
import { Validation } from "../db/models/Validation.js";
import { parseJsonValue } from "../utils/parseJson.js";
import { ValidationError } from "./validationService.js";

interface LLMFlag {
  severity: string;
  message: string;
}

interface MedicalData {
  fitnessResult: string | null;
  drugTestResult: string | null;
  restrictions: string | null;
  specialNotes: string | null;
  expiryDate: string | null;
}

interface FieldsData {
  holder?: {
    photo?: string;
  };
  [key: string]: unknown;
}

interface ValidationResultJson {
  holderProfile: {
    fullName: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    sirbNumber: string | null;
    rank: string | null;
    determinedRole: string;
  };
  consistencyChecks: Array<{
    field: string;
    status: string;
    detail: string;
  }>;
  missingDocuments: Array<{
    documentType: string;
    requiredFor: string;
    criticality: string;
  }>;
  expiringDocuments: Array<{
    documentType: string;
    expiryDate: string;
    daysRemaining: number;
    isExpired: boolean;
  }>;
  medicalFlags: Array<{
    severity: string;
    message: string;
  }>;
  overallStatus: string;
  overallScore: number;
  summary: string;
  recommendations: string[];
  validatedAt: string;
}

export interface ReportResult {
  sessionId: string;
  generatedAt: string;
  holderProfile: {
    fullName: string | null;
    dateOfBirth: string | null;
    nationality: string | null;
    sirbNumber: string | null;
    passportNumber: string | null;
    rank: string | null;
    determinedRole: string | null;
    photoPresent: boolean;
  };
  goNoGo: {
    status: "GO" | "NO-GO" | "CONDITIONAL" | "PENDING";
    reason: string | null;
  };
  documentChecklist: Array<{
    documentType: string;
    fileName: string;
    holderName: string | null;
    confidence: "HIGH" | "MEDIUM" | "LOW" | null;
    status: "PRESENT" | "EXPIRED" | "EXPIRING_SOON";
    expiryDate: string | null;
    daysUntilExpiry: number | null;
    flagCount: number;
    criticalFlagCount: number;
  }>;
  missingDocuments: Array<{
    documentType: string;
    requiredFor: string;
    criticality: string;
  }>;
  expiryTimeline: Array<{
    documentType: string;
    fileName: string;
    expiryDate: string;
    daysRemaining: number;
    isExpired: boolean;
  }>;
  flags: {
    critical: Array<{ documentType: string; fileName: string; message: string }>;
    high: Array<{ documentType: string; fileName: string; message: string }>;
    medium: Array<{ documentType: string; fileName: string; message: string }>;
    low: Array<{ documentType: string; fileName: string; message: string }>;
  };
  medicalSummary: {
    pemePresent: boolean;
    fitnessResult: string | null;
    drugTestPresent: boolean;
    drugTestResult: string | null;
    medicalFlags: Array<{ severity: string; message: string }>;
  };
  complianceScore: number | null;
  recommendations: string[];
  validationSummary: string | null;
}

function computeDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setUTCHours(0, 0, 0, 0);
  const diffMs = expiry.getTime() - today.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return days;
}

function deriveDetectedRole(extractions: Extraction[]): string | null {
  const roles = extractions
    .map((e) => e.applicableRole)
    .filter((role) => role && role !== "BOTH" && role !== "AMBIGUOUS");

  if (roles.length === 0) return null;

  const uniqueRoles = [...new Set(roles)];
  if (uniqueRoles.length === 1) {
    return uniqueRoles[0];
  }

  if (new Set(uniqueRoles).size > 1) {
    return "BOTH";
  }

  return null;
}

export async function generateReport(
  sessionId: string
): Promise<ReportResult> {
  // Step 1: Fetch session
  const session = await Session.findByPk(sessionId);
  if (!session) {
    throw new ValidationError("SESSION_NOT_FOUND", "Session not found");
  }

  // Step 2: Fetch all COMPLETE extractions ordered by createdAt ASC
  const extractions = await Extraction.findAll({
    where: {
      sessionId: sessionId,
      status: "COMPLETE"
    },
    order: [["createdAt", "ASC"]]
  });

  // Step 3: Fetch most recent validation
  const validation = await Validation.findOne({
    where: { sessionId: sessionId },
    order: [["createdAt", "DESC"]],
    limit: 1
  });

  const validationResult: ValidationResultJson | null = validation
    ? parseJsonValue<ValidationResultJson>(validation.resultJson)
    : null;

  // Derive holderProfile
  let determinedRole: string | null = null;
  let fullName: string | null = null;
  let dateOfBirth: string | null = null;
  let nationality: string | null = null;
  let sirbNumber: string | null = null;
  let rank: string | null = null;

  if (validationResult) {
    determinedRole = validationResult.holderProfile.determinedRole;
    fullName = validationResult.holderProfile.fullName;
    dateOfBirth = validationResult.holderProfile.dateOfBirth;
    nationality = validationResult.holderProfile.nationality;
    sirbNumber = validationResult.holderProfile.sirbNumber;
    rank = validationResult.holderProfile.rank;
  } else {
    determinedRole = deriveDetectedRole(extractions);
    // Try to extract from extractions
    const firstExtraction = extractions.find(
      (e) => e.holderName || e.dateOfBirth || e.nationality || e.sirbNumber || e.rank
    );
    if (firstExtraction) {
      fullName = firstExtraction.holderName || null;
      dateOfBirth = firstExtraction.dateOfBirth || null;
      nationality = firstExtraction.nationality || null;
      sirbNumber = firstExtraction.sirbNumber || null;
      rank = firstExtraction.rank || null;
    }
  }

  const photoPresent = extractions.some((e) => e.holderPhoto === "PRESENT");

  // Get most recent passport number
  let passportNumber: string | null = null;
  for (let i = extractions.length - 1; i >= 0; i--) {
    if (extractions[i].passportNumber) {
      passportNumber = extractions[i].passportNumber;
      break;
    }
  }

  // Derive goNoGo
  let goNoGoStatus: "GO" | "NO-GO" | "CONDITIONAL" | "PENDING";
  let goNoGoReason: string | null = null;

  if (validationResult) {
    if (validationResult.overallStatus === "APPROVED") {
      goNoGoStatus = "GO";
    } else if (validationResult.overallStatus === "REJECTED") {
      goNoGoStatus = "NO-GO";
    } else if (validationResult.overallStatus === "CONDITIONAL") {
      goNoGoStatus = "CONDITIONAL";
    } else {
      goNoGoStatus = "PENDING";
    }

    if (validationResult.recommendations && validationResult.recommendations.length > 0) {
      goNoGoReason = validationResult.recommendations[0];
    }
  } else {
    goNoGoStatus = "PENDING";
  }

  // Build documentChecklist
  const documentChecklist = extractions.map((extraction) => {
    const flags = parseJsonValue<LLMFlag[]>(extraction.flagsJson) || [];
    const criticalFlags = flags.filter((f) => f.severity === "CRITICAL");

    let status: "PRESENT" | "EXPIRED" | "EXPIRING_SOON";
    if (extraction.isExpired) {
      status = "EXPIRED";
    } else if (extraction.expiryDate) {
      const daysUntil = computeDaysUntilExpiry(extraction.expiryDate);
      if (daysUntil !== null && daysUntil < 90) {
        status = "EXPIRING_SOON";
      } else {
        status = "PRESENT";
      }
    } else {
      status = "PRESENT";
    }

    return {
      documentType: extraction.documentType || "",
      fileName: extraction.fileName,
      holderName: extraction.holderName || null,
      confidence: (extraction.confidence as "HIGH" | "MEDIUM" | "LOW" | null) || null,
      status,
      expiryDate: extraction.expiryDate || null,
      daysUntilExpiry: computeDaysUntilExpiry(extraction.expiryDate),
      flagCount: flags.length,
      criticalFlagCount: criticalFlags.length
    };
  });

  // Derive missingDocuments
  const missingDocuments = validationResult ? validationResult.missingDocuments : [];

  // Build expiryTimeline
  const expiryTimeline = extractions
    .filter((e) => e.expiryDate)
    .map((extraction) => {
      const daysRemaining = computeDaysUntilExpiry(extraction.expiryDate);
      return {
        documentType: extraction.documentType || "",
        fileName: extraction.fileName,
        expiryDate: extraction.expiryDate!,
        daysRemaining: daysRemaining !== null ? daysRemaining : 0,
        isExpired: extraction.isExpired
      };
    })
    .sort(
      (a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime()
    );

  // Build flags
  const flags: {
    critical: Array<{ documentType: string; fileName: string; message: string }>;
    high: Array<{ documentType: string; fileName: string; message: string }>;
    medium: Array<{ documentType: string; fileName: string; message: string }>;
    low: Array<{ documentType: string; fileName: string; message: string }>;
  } = {
    critical: [],
    high: [],
    medium: [],
    low: []
  };

  for (const extraction of extractions) {
    const extractionFlags = parseJsonValue<LLMFlag[]>(extraction.flagsJson) || [];
    for (const flag of extractionFlags) {
      const flagEntry = {
        documentType: extraction.documentType || "",
        fileName: extraction.fileName,
        message: flag.message
      };

      if (flag.severity === "CRITICAL") {
        flags.critical.push(flagEntry);
      } else if (flag.severity === "HIGH") {
        flags.high.push(flagEntry);
      } else if (flag.severity === "MEDIUM") {
        flags.medium.push(flagEntry);
      } else if (flag.severity === "LOW") {
        flags.low.push(flagEntry);
      }
    }
  }

  // Build medicalSummary
  const pemeExtraction = extractions.find((e) => e.documentType === "PEME");
  const drugTestExtraction = extractions.find((e) => e.documentType === "DRUG_TEST");

  let fitnessResult: string | null = null;
  if (pemeExtraction) {
    const medicalData = parseJsonValue<MedicalData>(pemeExtraction.medicalDataJson);
    fitnessResult = medicalData ? medicalData.fitnessResult : null;
  }

  let drugTestResult: string | null = null;
  if (drugTestExtraction) {
    const medicalData = parseJsonValue<MedicalData>(drugTestExtraction.medicalDataJson);
    drugTestResult = medicalData ? medicalData.drugTestResult : null;
  }

  const medicalFlagsFromValidation = validationResult
    ? validationResult.medicalFlags
    : [];

  // Final result
  const result: ReportResult = {
    sessionId: sessionId,
    generatedAt: new Date().toISOString(),
    holderProfile: {
      fullName,
      dateOfBirth,
      nationality,
      sirbNumber,
      passportNumber,
      rank,
      determinedRole,
      photoPresent
    },
    goNoGo: {
      status: goNoGoStatus,
      reason: goNoGoReason
    },
    documentChecklist,
    missingDocuments,
    expiryTimeline,
    flags,
    medicalSummary: {
      pemePresent: !!pemeExtraction,
      fitnessResult,
      drugTestPresent: !!drugTestExtraction,
      drugTestResult,
      medicalFlags: medicalFlagsFromValidation
    },
    complianceScore: validationResult ? validationResult.overallScore : null,
    recommendations: validationResult ? validationResult.recommendations : [],
    validationSummary: validationResult ? validationResult.summary : null
  };

  return result;
}
