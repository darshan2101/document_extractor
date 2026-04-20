import express from "express";
import { pino } from "pino";

import { errorHandler } from "./middleware/errorHandler.js";
import { router } from "./routes/index.js";

const logger = pino({ name: "smde-app" });

export const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", router);
app.use(errorHandler);

logger.info("Express app initialized.");
