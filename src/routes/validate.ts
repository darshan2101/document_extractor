import { Router } from "express";

import { validationService, ValidationError } from "../services/validationService.js";

const router = Router();

router.post("/sessions/:sessionId/validate", async (request, response, next) => {
  try {
    const { sessionId } = request.params;

    const validationResult = await validationService.validateSession(sessionId);

    response.status(200).json(validationResult);
  } catch (error) {
    if (error instanceof ValidationError) {
      if (error.code === "SESSION_NOT_FOUND") {
        response.status(404).json({
          error: error.code,
          message: error.message
        });
        return;
      }

      if (error.code === "INSUFFICIENT_DOCUMENTS") {
        response.status(400).json({
          error: error.code,
          message: error.message
        });
        return;
      }
    }

    next(error);
  }
});

export { router as validateRouter };
