import type { Worker } from "bullmq";
import { pino } from "pino";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/index.js";
import { createExtractionWorker } from "./queue/worker.js";
import type { JobPayload } from "./queue/worker.js";

const logger = pino({ name: "smde-server" });

export let extractionWorker: Worker<JobPayload> | null = null;

const startServer = async (): Promise<void> => {
  try {
    await initializeDatabase();
  } catch (error) {
    logger.error({ err: error }, "Database sync failed");
    process.exit(1);
  }

  // Initialize extraction worker
  extractionWorker = createExtractionWorker();
  logger.info("Extraction worker started");

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "SMDE server started");
  });

  server.on("error", (error: Error) => {
    logger.error({ err: error }, "SMDE server failed to start");
    process.exit(1);
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    logger.info("SIGTERM received, shutting down gracefully");
    if (extractionWorker) {
      await extractionWorker.close();
    }
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    logger.info("SIGINT received, shutting down gracefully");
    if (extractionWorker) {
      await extractionWorker.close();
    }
    process.exit(0);
  });
};

void startServer();
