import { Sequelize } from "sequelize-typescript";
import { pino } from "pino";

import { env } from "../config/env.js";
import { Extraction } from "./models/Extraction.js";
import { Job } from "./models/Job.js";
import { Session } from "./models/Session.js";
import { Validation } from "./models/Validation.js";

const logger = pino({ name: "smde-db" });

export const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: env.DATABASE_URL,
  models: [Session, Extraction, Job, Validation]
});

export const initializeDatabase = async (): Promise<void> => {
  if (env.NODE_ENV !== "development") {
    return;
  }

  await sequelize.sync({ alter: false });
  logger.info("Database sync completed.");
};
