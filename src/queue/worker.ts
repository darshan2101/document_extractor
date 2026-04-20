import type { Express } from "express";
import { Worker } from "bullmq";
import { pino } from "pino";

import { queueConnection } from "./index.js";
import { Job } from "../db/models/Job.js";
import { extractionService } from "../services/extractionService.js";
import type { ExtractionServiceError } from "../services/extractionService.js";

const logger = pino({ name: "smde-worker" });

export interface JobPayload {
  fileBuffer: number[];
  mimeType: string;
  fileName: string;
  sessionId: string;
  fileHash: string;
  jobId: string;
}

export const createExtractionWorker = (): Worker<JobPayload> => {
  const worker = new Worker<JobPayload>(
    "document-extraction",
    async (bullJob) => {
      const { fileBuffer, mimeType, fileName, sessionId, jobId } = bullJob.data;

      try {
        // Step 1: Update Job record status to PROCESSING
        let job = await Job.findByPk(jobId);
        if (!job) {
          logger.error({ jobId }, "Job record not found");
          throw new Error("Job record not found");
        }

        job.status = "PROCESSING";
        job.startedAt = new Date();
        await job.save();

        // Step 2: Reconstruct Buffer from array
        const buffer = Buffer.from(fileBuffer);

        // Step 3: Create a mock Express.Multer.File object
        const file = {
          buffer,
          mimetype: mimeType,
          originalname: fileName,
          fieldname: "document",
          encoding: "7bit",
          size: buffer.length
        } as Express.Multer.File;

        // Step 4: Call extraction service
        const extraction = await extractionService.runExtraction(file, sessionId);

        // Step 5: Update Job record on success
        job.status = "COMPLETE";
        job.extractionId = extraction.id;
        job.completedAt = new Date();
        await job.save();

        return { success: true, extractionId: extraction.id };
      } catch (error) {
        // Step 6: Update Job record on failure
        const job = await Job.findByPk(jobId);

        if (job) {
          const serviceError = error as ExtractionServiceError;
          job.status = "FAILED";
          job.errorCode = error instanceof Error ? error.name : "UNKNOWN_ERROR";
          job.errorMessage = error instanceof Error ? error.message : String(error);
          job.completedAt = new Date();
          job.retryable = serviceError.retryable ?? false;
          await job.save();
        }

        logger.error(
          { jobId: jobId, error: error instanceof Error ? error.message : String(error) },
          "Job processing failed"
        );

        throw error;
      }
    },
    {
      connection: queueConnection
    }
  );

  worker.on("error", (err) => {
    logger.error({ err }, "Worker error");
  });

  worker.on("failed", (job, err) => {
    logger.warn(
      { jobId: job?.id, error: err?.message },
      "Job failed but worker handled it gracefully"
    );
  });

  return worker;
};

