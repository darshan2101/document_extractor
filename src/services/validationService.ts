import { Session } from "../db/models/Session.js";
import { Extraction } from "../db/models/Extraction.js";
import { Validation } from "../db/models/Validation.js";
import { getLLMProvider } from "../llm/index.js";
import { parseJsonValue } from "../utils/parseJson.js";

export class ValidationError extends Error {
  constructor(
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ValidationError";
  }
}

type LLMField = {
  key: string;
  label: string;
  value: string;
  importance: string;
  status: string;
};

type LLMValidity = {
  daysUntilExpiry: number | null;
  isExpired: boolean;
};

type LLMMedicalData = {
  result: string;
  daysValid: number | null;
};

type LLMCompliance = {
  flag: string;
  satisfied: boolean;
};

export interface ValidationResult {
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

const VALIDATION_PROMPT_TEMPLATE = `You are a senior maritime compliance officer reviewing a seafarer's complete document package for employment eligibility.

You have been given the extracted data from all documents submitted for this session. Your task is to perform a cross-document compliance assessment.

SESSION DATA:
{{SESSION_JSON}}

Perform the following checks in order:

1. IDENTITY CONSISTENCY — Do the full name, date of birth, and nationality match across all documents? Flag any discrepancy, even minor spelling differences.

2. SIRB PRESENCE — Is a Seaman's Identification and Record Book (SIRB) present? Is the SIRB number consistent across all documents that reference it?

3. ROLE DETERMINATION — Based on the documents present, is this seafarer a DECK officer, ENGINE officer, or ambiguous? State which documents informed this determination.

4. REQUIRED DOCUMENTS FOR ROLE — Based on the determined role, identify which of the following required documents are PRESENT, MISSING, or EXPIRED:
   - For DECK: COC, SIRB, PASSPORT, PEME, DRUG_TEST, COP_BT, COP_PSCRB, ECDIS_GENERIC
   - For ENGINE: COC, SIRB, PASSPORT, PEME, DRUG_TEST, COP_BT, ERM
   - For BOTH or ambiguous: apply the union of both lists

5. EXPIRY REVIEW — List every document that is expired or will expire within 90 days. Include the document type, expiry date, and days remaining.

6. MEDICAL FLAGS — Summarize the PEME result and drug test result. Flag if PEME result is not FIT, drug test is not NEGATIVE, or if no medical document is present.

7. OVERALL ASSESSMENT — Based on all checks above, assign one of:
   - APPROVED: All required documents present, valid, consistent, medically cleared
   - CONDITIONAL: Minor issues that can be resolved before embarkation (expiring soon, minor inconsistency)
   - REJECTED: Missing critical documents, expired required cert, medical fail, or identity inconsistency

Return ONLY a valid JSON object. No markdown. No code fences. No preamble.

{
  "holderProfile": {
    "fullName": "string or null",
    "dateOfBirth": "string or null",
    "nationality": "string or null",
    "sirbNumber": "string or null",
    "rank": "string or null",
    "determinedRole": "DECK | ENGINE | BOTH | AMBIGUOUS"
  },
  "consistencyChecks": [
    {
      "field": "fullName | dateOfBirth | nationality | sirbNumber",
      "status": "CONSISTENT | INCONSISTENT | MISSING",
      "detail": "string"
    }
  ],
  "missingDocuments": [
    {
      "documentType": "string",
      "requiredFor": "DECK | ENGINE | BOTH",
      "criticality": "CRITICAL | HIGH | MEDIUM"
    }
  ],
  "expiringDocuments": [
    {
      "documentType": "string",
      "expiryDate": "string",
      "daysRemaining": 0,
      "isExpired": false
    }
  ],
  "medicalFlags": [
    {
      "severity": "CRITICAL | HIGH | MEDIUM | LOW",
      "message": "string"
    }
  ],
  "overallStatus": "APPROVED | CONDITIONAL | REJECTED",
  "overallScore": 0,
  "summary": "Two to three sentence plain English summary of the compliance assessment.",
  "recommendations": ["string"]
}`;

export const validationService = {
  async validateSession(sessionId: string): Promise<ValidationResult> {
    // Step 1: Fetch session
    const session = await Session.findByPk(sessionId);
    if (!session) {
      throw new ValidationError("SESSION_NOT_FOUND", "The specified session was not found.");
    }

    // Step 2: Fetch all COMPLETE extractions ordered by createdAt
    const extractions = await Extraction.findAll({
      where: { sessionId, status: "COMPLETE" },
      order: [["createdAt", "ASC"]]
    });

    // Step 3: Check minimum document count
    if (extractions.length < 2) {
      throw new ValidationError(
        "INSUFFICIENT_DOCUMENTS",
        "At least 2 documents are required for validation."
      );
    }

    // Step 4: Build session JSON with extraction data
    const sessionData = extractions.map(ext => ({
      id: ext.id,
      fileName: ext.fileName,
      documentType: ext.documentType,
      applicableRole: ext.applicableRole,
      holderName: ext.holderName,
      dateOfBirth: ext.dateOfBirth,
      sirbNumber: ext.sirbNumber,
      passportNumber: ext.passportNumber,
      nationality: ext.nationality,
      rank: ext.rank,
      confidence: ext.confidence,
      isExpired: ext.isExpired,
      expiryDate: ext.expiryDate,
      fieldsJson: parseJsonValue<LLMField[]>(ext.fieldsJson),
      flagsJson: parseJsonValue<Array<{ severity: string; message: string }>>(ext.flagsJson),
      medicalDataJson: parseJsonValue<LLMMedicalData>(ext.medicalDataJson),
      validityJson: parseJsonValue<LLMValidity>(ext.validityJson),
      summary: ext.summary
    }));

    const sessionJson = JSON.stringify(sessionData, null, 2);
    const prompt = VALIDATION_PROMPT_TEMPLATE.replace("{{SESSION_JSON}}", sessionJson);

    // Step 5: Call LLM provider's validate method
    const provider = getLLMProvider();
    const validationJsonString = await provider.validate(prompt);

    // Step 6: Parse the result
    const validationResult = JSON.parse(validationJsonString) as Omit<
      ValidationResult,
      "validatedAt"
    >;

    // Step 7: Persist to validations table
    await Validation.create({
      sessionId,
      resultJson: validationJsonString
    });

    // Step 8: Return with validatedAt timestamp
    return {
      ...validationResult,
      validatedAt: new Date().toISOString()
    };
  }
};
