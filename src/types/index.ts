export type JobStatus = "QUEUED" | "PROCESSING" | "COMPLETE" | "FAILED";

export type ExtractionStatus = "COMPLETE" | "FAILED";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface LLMDetection {
  documentType: string;
  documentName: string;
  category: string;
  applicableRole: string;
  isRequired: boolean;
  confidence: Confidence;
  detectionReason: string;
}

export interface LLMHolder {
  fullName: string | null;
  dateOfBirth: string | null;
  nationality: string | null;
  passportNumber: string | null;
  sirbNumber: string | null;
  rank: string | null;
  photo: "PRESENT" | "ABSENT";
}

export interface LLMField {
  key: string;
  label: string;
  value: string;
  importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  status: "OK" | "EXPIRED" | "WARNING" | "MISSING" | "N/A";
}

export interface LLMValidity {
  dateOfIssue: string | null;
  dateOfExpiry: string | "No Expiry" | "Lifetime" | null;
  isExpired: boolean;
  daysUntilExpiry: number | null;
  revalidationRequired: boolean | null;
}

export interface LLMCompliance {
  issuingAuthority: string;
  regulationReference: string | null;
  imoModelCourse: string | null;
  recognizedAuthority: boolean;
  limitations: string | null;
}

export interface LLMMedicalData {
  fitnessResult: "FIT" | "UNFIT" | "N/A";
  drugTestResult: "NEGATIVE" | "POSITIVE" | "N/A";
  restrictions: string | null;
  specialNotes: string | null;
  expiryDate: string | null;
}

export interface LLMFlag {
  severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  message: string;
}

export interface LLMExtractionResult {
  raw: string;
  detection: LLMDetection;
  holder: LLMHolder;
  fields: LLMField[];
  validity: LLMValidity;
  compliance: LLMCompliance;
  medicalData: LLMMedicalData;
  flags: LLMFlag[];
  summary: string;
}
