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

router.post("/extract", upload, async (request, response) => {
  const mode = typeof request.query.mode === "string" ? request.query.mode : "sync";

  if (mode === "async") {
    response
      .status(501)
      .json(
        createErrorResponse("NOT_IMPLEMENTED", "Async extraction is not implemented yet.")
      );
    return;
  }

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

  let sessionId = requestedSessionId;

  if (!sessionId) {
    sessionId = uuidv4();
    await Session.create({ id: sessionId });
  } else {
    const session = await Session.findByPk(sessionId);

    if (!session) {
      response
        .status(404)
        .json(
          createErrorResponse("SESSION_NOT_FOUND", "The provided sessionId does not exist.")
        );
      return;
    }
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
