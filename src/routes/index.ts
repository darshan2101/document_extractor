import { Router } from "express";

import { extractRouter } from "./extract.js";
import { healthRouter } from "./health.js";
import { jobsRouter } from "./jobs.js";
import { sessionsRouter } from "./sessions.js";
import { validateRouter } from "./validate.js";
import { reportRouter } from "./report.js";

const router = Router();

router.use("/", extractRouter);
router.use("/", healthRouter);
router.use("/", jobsRouter);
router.use("/", sessionsRouter);
router.use("/", validateRouter);
router.use("/", reportRouter);

export { router };
