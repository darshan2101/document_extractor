import { Router } from "express";

import { sessionService } from "../services/sessionService.js";

const router = Router();

router.get("/sessions/:sessionId", async (request, response, next) => {
  try {
    const { sessionId } = request.params;

    const sessionDetails = await sessionService.getSessionDetails(sessionId);

    if (!sessionDetails) {
      response.status(404).json({
        error: "SESSION_NOT_FOUND",
        message: "The specified session was not found."
      });
      return;
    }

    response.status(200).json(sessionDetails);
  } catch (error) {
    next(error);
  }
});

export { router as sessionsRouter };
