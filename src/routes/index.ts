import { Router } from "express";

import { extractRouter } from "./extract.js";
import { healthRouter } from "./health.js";
import { jobsRouter } from "./jobs.js";
import { sessionsRouter } from "./sessions.js";

const router = Router();

router.use("/", extractRouter);
router.use("/", healthRouter);
router.use("/", jobsRouter);
router.use("/", sessionsRouter);

export { router };
