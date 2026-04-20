import { Router } from "express";
import { v4 as uuidv4 } from "uuid";

import { Extraction } from "../db/models/Extraction.js";
import { Job } from "../db/models/Job.js";
import { Session } from "../db/models/Session.js";
import { extractionQueue } from "../queue/index.js";
import type { JobPayload } from "../queue/worker.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { upload } from "../middleware/upload.js";
import {
  extractionService,
  formatExtractionResponse,
  type ExtractionServiceError
} from "../services/extractionService.js";
import { hashFile } from "../utils/hashFile.js";

const router = Router();

const createErrorResponse = (error: string, message: string) => ({
  error,
  message,
  extractionId: null,
  retryAfterMs: null
});

router.post("/extract", rateLimiter, upload, async (request, response) => {
  const mode = typeof request.query.mode === "string" ? request.query.mode : "sync";

  if (!request.file) {
    response
      .status(400)
      .json(
        createErrorResponse(
          "UNSUPPORTED_FORMAT",
          "Only JPEG, PNG, and PDF files are supported."
        )
      );
    return;
  }

  const requestedSessionId =
    typeof request.body.sessionId === "string" && request.body.sessionId.trim()
      ? request.body.sessionId.trim()
      : null;

  let sessionId: string;

  if (requestedSessionId) {
    const session = await Session.findByPk(requestedSessionId);

    if (!session) {
      response
        .status(404)
        .json(
          createErrorResponse("SESSION_NOT_FOUND", "The provided sessionId does not exist.")
        );
      return;
    }
    sessionId = requestedSessionId;
  } else {
    sessionId = uuidv4();
    // Sequelize type system requires this escape hatch for partial attribute creation
    await (Session.create as any)({ id: sessionId });
  }

  const fileHash = hashFile(request.file.buffer);
  const existingExtraction = await Extraction.findOne({
    where: {
      fileHash,
      sessionId
    }
  });

  if (existingExtraction) {
    response.setHeader("X-Deduplicated", "true");
    response.status(200).json(formatExtractionResponse(existingExtraction));
    return;
  }

  // Async mode handling
  if (mode === "async") {
    const jobId = uuidv4();

    // Create Job record with status QUEUED
    // Sequelize type system requires this escape hatch for partial attribute creation
    await (Job.create as any)({
      id: jobId,
      sessionId,
      status: "QUEUED",
      queuedAt: new Date()
    });

    // Prepare payload with serialized buffer
    const payload: JobPayload = {
      fileBuffer: Array.from(request.file.buffer),
      mimeType: request.file.mimetype,
      fileName: request.file.originalname,
      sessionId,
      fileHash,
      jobId
    };

    // Add job to BullMQ queue
    await extractionQueue.add("process-extraction", payload);

    // Return 202 Accepted
    response.status(202).json({
      jobId,
      sessionId,
      status: "QUEUED",
      pollUrl: `/api/jobs/${jobId}`,
      estimatedWaitMs: 6000
    });
    return;
  }

  // Sync mode handling
  try {
    const extraction = await extractionService.runExtraction(request.file, sessionId);
    response.status(200).json(extraction);
  } catch (error) {
    const routeError = error as ExtractionServiceError;

    if (routeError.retryable) {
      response.status(503).json({
        error: "LLM_TEMPORARY_FAILURE",
        message: "LLM request timed out. Retry later.",
        extractionId: routeError.extractionId,
        retryAfterMs: 30000
      });
      return;
    }

    if (routeError.message === "LLM_JSON_PARSE_FAIL") {
      response.status(502).json({
        error: "LLM_JSON_PARSE_FAIL",
        message: "LLM returned an invalid JSON response.",
        extractionId: routeError.extractionId,
        retryAfterMs: null
      });
      return;
    }

    throw error;
  }
});

export { router as extractRouter };
