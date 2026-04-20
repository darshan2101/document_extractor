import { pino } from "pino";

import { app } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/index.js";

const logger = pino({ name: "smde-server" });

const startServer = async (): Promise<void> => {
  try {
    await initializeDatabase();
  } catch (error) {
    logger.error({ err: error }, "Database sync failed");
    process.exit(1);
  }

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, "SMDE server started");
  });

  server.on("error", (error: Error) => {
    logger.error({ err: error }, "SMDE server failed to start");
    process.exit(1);
  });
};

void startServer();
