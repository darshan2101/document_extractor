import { Router } from "express";

import { jobService } from "../services/jobService.js";
import { extractionQueue } from "../queue/index.js";
import { Job } from "../db/models/Job.js";
import type { JobPayload } from "../queue/worker.js";

const router = Router();

router.get("/jobs/:jobId", async (request, response, next) => {
  try {
    const { jobId } = request.params;

    const jobStatus = await jobService.getJobWithStatus(jobId);

    if (!jobStatus) {
      response.status(404).json({
        error: "JOB_NOT_FOUND",
        message: "The specified job was not found."
      });
      return;
    }

    response.status(200).json(jobStatus);
  } catch (error) {
    next(error);
  }
});

router.post("/jobs/:jobId/retry", async (request, response, next) => {
  try {
    const { jobId } = request.params;

    const job = await Job.findByPk(jobId);

    if (!job) {
      response.status(404).json({
        error: "JOB_NOT_FOUND",
        message: "The specified job was not found."
      });
      return;
    }

    if (job.status !== "FAILED") {
      response.status(409).json({
        error: "JOB_NOT_RETRYABLE",
        message: `Job is in status ${job.status} and can only be retried when FAILED.`
      });
      return;
    }

    // Find the original BullMQ job to retrieve its payload
    const bullJob = await extractionQueue.getJob(jobId);
    if (!bullJob) {
      response.status(422).json({
        error: "JOB_PAYLOAD_MISSING",
        message: "Original job payload no longer in queue. Cannot retry."
      });
      return;
    }

    // Reset job record to QUEUED
    job.status = "QUEUED";
    job.errorCode = null;
    job.errorMessage = null;
    job.startedAt = null;
    job.completedAt = null;
    job.retryable = null;
    job.queuedAt = new Date();
    await job.save();

    // Re-enqueue with the original payload
    const payload = bullJob.data as JobPayload;
    await extractionQueue.add("process-extraction", payload);

    response.status(202).json({
      jobId: job.id,
      sessionId: job.sessionId,
      status: "QUEUED",
      pollUrl: `/api/jobs/${job.id}`,
      estimatedWaitMs: 6000
    });
  } catch (error) {
    next(error);
  }
});

export { router as jobsRouter };
