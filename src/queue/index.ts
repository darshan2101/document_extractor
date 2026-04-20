import { Queue } from "bullmq";
import Redis from "ioredis";

import { env } from "../config/env.js";

export const queueConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null
});

export const extractionQueue = new Queue("document-extraction", {
  connection: queueConnection
});
