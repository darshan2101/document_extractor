import { Job } from "../db/models/Job.js";
import { Extraction } from "../db/models/Extraction.js";
import { formatExtractionResponse } from "./extractionService.js";
import type { LLMFlag } from "../types/index.js";
import { parseJsonValue } from "../utils/parseJson.js";

export interface JobStatusResponse {
  jobId: string;
  status: string;
  queuePosition?: null;
  queuedAt?: string;
  estimatedWaitMs?: number;
  startedAt?: string;
  estimatedCompleteMs?: number;
  extractionId?: string;
  result?: any;
  completedAt?: string;
  error?: string;
  message?: string;
  failedAt?: string;
  retryable?: boolean;
}

export const jobService = {
  async getJobWithStatus(jobId: string): Promise<JobStatusResponse | null> {
    const job = await Job.findByPk(jobId);

    if (!job) {
      return null;
    }

    switch (job.status) {
      case "QUEUED": {
        return {
          jobId: job.id,
          status: "QUEUED",
          queuePosition: null,
          queuedAt: job.queuedAt.toISOString(),
          estimatedWaitMs: 6000 // Static estimate; Phase 7 can derive from queue depth
        };
      }

      case "PROCESSING": {
        return {
          jobId: job.id,
          status: "PROCESSING",
          queuePosition: null,
          startedAt: job.startedAt?.toISOString(),
          estimatedCompleteMs: 3200 // Static estimate; Phase 7 can derive from queue metrics
        };
      }

      case "COMPLETE": {
        // Eager-load the associated Extraction record
        const extraction = await Extraction.findByPk(job.extractionId ?? "");

        return {
          jobId: job.id,
          status: "COMPLETE",
          extractionId: job.extractionId ?? undefined,
          result: extraction ? formatExtractionResponse(extraction) : undefined,
          completedAt: job.completedAt?.toISOString()
        };
      }

      case "FAILED": {
        return {
          jobId: job.id,
          status: "FAILED",
          error: job.errorCode ?? "UNKNOWN_ERROR",
          message: job.errorMessage ?? "An unknown error occurred",
          failedAt: job.completedAt?.toISOString(),
          // retryable flag is set by the worker based on error context (e.g., LLM timeouts)
          retryable: job.retryable ?? false
        };
      }

      default: {
        return {
          jobId: job.id,
          status: job.status
        };
      }
    }
  }
};
