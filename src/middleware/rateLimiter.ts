import type { NextFunction, Request, Response } from "express";

type Bucket = {
  tokens: number;
  lastRefill: number;
};

const MAX_TOKENS = 10;
const WINDOW_MS = 60_000;
const REFILL_RATE_PER_MS = MAX_TOKENS / WINDOW_MS;
const buckets = new Map<string, Bucket>();

const getClientIp = (request: Request): string =>
  request.ip ||
  request.socket.remoteAddress ||
  "unknown";

const getRefilledBucket = (bucket: Bucket, now: number): Bucket => {
  const elapsedMs = now - bucket.lastRefill;
  const replenishedTokens = elapsedMs * REFILL_RATE_PER_MS;

  return {
    tokens: Math.min(MAX_TOKENS, bucket.tokens + replenishedTokens),
    lastRefill: now
  };
};

const getRetryAfterMs = (tokens: number): number =>
  Math.ceil((1 - tokens) / REFILL_RATE_PER_MS);

export const rateLimiter = (
  request: Request,
  response: Response,
  next: NextFunction
): void => {
  const now = Date.now();
  const key = getClientIp(request);
  const existingBucket = buckets.get(key) ?? {
    tokens: MAX_TOKENS,
    lastRefill: now
  };
  const bucket = getRefilledBucket(existingBucket, now);

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    buckets.set(key, bucket);
    next();
    return;
  }

  const retryAfterMs = getRetryAfterMs(bucket.tokens);
  buckets.set(key, bucket);

  response.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000).toString());
  response.status(429).json({
    error: "RATE_LIMITED",
    message: "Too many requests. Please slow down.",
    extractionId: null,
    retryAfterMs
  });
};
