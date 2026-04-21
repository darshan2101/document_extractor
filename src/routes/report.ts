import { Router } from "express";
import { generateReport } from "../services/reportService.js";
import { ValidationError } from "../services/validationService.js";

export const reportRouter = Router();

reportRouter.get("/sessions/:sessionId/report", async (req, res, next) => {
  try {
    const sessionId = req.params["sessionId"] as string;
    const report = await generateReport(sessionId);
    res.status(200).json(report);
  } catch (error) {
    if (error instanceof ValidationError && error.code === "SESSION_NOT_FOUND") {
      res.status(404).json({
        code: "SESSION_NOT_FOUND",
        message: "Session not found"
      });
    } else {
      next(error);
    }
  }
});
