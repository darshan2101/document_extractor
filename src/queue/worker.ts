import type { Express } from "express";
import { Worker } from "bullmq";
import { pino } from "pino";

import { queueConnection } from "./index.js";
import { Job } from "../db/models/Job.js";
import { extractionService } from "../services/extractionService.js";
import type { ExtractionServiceError } from "../services/extractionService.js";
import { deliverWebhook } from "../utils/webhook.js";
import { env } from "../config/env.js";

const logger = pino({ name: "smde-worker" });

export interface JobPayload {
  fileBuffer: number[];
  mimeType: string;
  fileName: string;
  sessionId: string;
  fileHash: string;
  jobId: string;
  webhookUrl: string | null;
}

export const createExtractionWorker = (): Worker<JobPayload> => {
  const worker = new Worker<JobPayload>(
    "document-extraction",
    async (bullJob) => {
      const { fileBuffer, mimeType, fileName, sessionId, jobId, webhookUrl } = bullJob.data;

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

        // Step 6: Fire webhook if configured — failure is logged but never crashes the job
        if (webhookUrl) {
          try {
            await deliverWebhook(
              webhookUrl,
              { jobId, status: "COMPLETE", extractionId: extraction.id, result: extraction },
              env.WEBHOOK_SECRET
            );
            logger.info({ jobId, webhookUrl }, "Webhook delivered");
          } catch (webhookErr) {
            logger.warn(
              { jobId, webhookUrl, error: webhookErr instanceof Error ? webhookErr.message : String(webhookErr) },
              "Webhook delivery failed — job result is still stored"
            );
          }
        }

        return { success: true, extractionId: extraction.id };
      } catch (error) {
        // Step 7: Update Job record on failure
        const job = await Job.findByPk(jobId);

        if (job) {
          const serviceError = error as ExtractionServiceError;
          job.status = "FAILED";
          job.errorCode = error instanceof Error ? error.name : "UNKNOWN_ERROR";
          job.errorMessage = error instanceof Error ? error.message : String(error);
          job.completedAt = new Date();
          job.retryable = serviceError.retryable ?? false;
          await job.save();

          // Fire webhook on failure too
          if (webhookUrl) {
            try {
              await deliverWebhook(
                webhookUrl,
                {
                  jobId,
                  status: "FAILED",
                  error: job.errorCode,
                  message: job.errorMessage,
                  retryable: job.retryable
                },
                env.WEBHOOK_SECRET
              );
            } catch (webhookErr) {
              logger.warn(
                { jobId, webhookUrl, error: webhookErr instanceof Error ? webhookErr.message : String(webhookErr) },
                "Webhook delivery failed on job failure"
              );
            }
          }
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
