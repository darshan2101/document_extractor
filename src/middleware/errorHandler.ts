import type { NextFunction, Request, Response } from "express";
import { pino } from "pino";

const logger = pino({ name: "error-handler" });

export const errorHandler = (
  error: Error,
  _request: Request,
  response: Response,
  _next: NextFunction
): void => {
  logger.error({ err: error }, "Unhandled application error");

  response.status(500).json({
    error: "INTERNAL_ERROR",
    message: error.message
  });
};
