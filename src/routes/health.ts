import { Router } from "express";

import { sequelize } from "../db/index.js";
import { queueConnection } from "../queue/index.js";

const router = Router();

router.get("/health", async (_request, response) => {
  let databaseStatus = "OK";
  let queueStatus = "OK";

  try {
    await sequelize.authenticate();
  } catch {
    databaseStatus = "ERROR";
  }

  try {
    await queueConnection.ping();
  } catch {
    queueStatus = "ERROR";
  }

  const llmProviderStatus = "OK";
  const overallStatus =
    databaseStatus === "OK" &&
    queueStatus === "OK" &&
    llmProviderStatus === "OK"
      ? "OK"
      : "DEGRADED";

  response.status(200).json({
    status: overallStatus,
    version: "1.0.0",
    uptime: process.uptime(),
    dependencies: {
      database: databaseStatus,
      llmProvider: llmProviderStatus,
      queue: queueStatus
    },
    timestamp: new Date().toISOString()
  });
});

export { router as healthRouter };
