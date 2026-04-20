import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import { pino } from "pino";

const logger = pino({ name: "error-handler" });

type ErrorResponseBody = {
  error: string;
  message: string;
  extractionId: null;
  retryAfterMs: null;
};

const createErrorResponse = (
  errorCode: string,
  message: string
): ErrorResponseBody => ({
  error: errorCode,
  message,
  extractionId: null,
  retryAfterMs: null
});

export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  logger.error({ err: error }, "Unhandled application error");

  if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
    response.status(413).json(
      createErrorResponse("FILE_TOO_LARGE", "Uploaded file exceeds 10MB limit.")
    );
    return;
  }

  if (error.message === "UNSUPPORTED_FORMAT") {
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

  response.status(500).json({
    error: "INTERNAL_ERROR",
    message: error.message,
    extractionId: null,
    retryAfterMs: null
  });
};
