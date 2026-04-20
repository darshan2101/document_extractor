import { Router } from "express";

import { extractRouter } from "./extract.js";
import { healthRouter } from "./health.js";

const router = Router();

router.use("/", extractRouter);
router.use("/", healthRouter);

export { router };
