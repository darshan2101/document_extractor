import { Router } from "express";
import { Op } from "sequelize";

import { sessionService } from "../services/sessionService.js";
import { Session } from "../db/models/Session.js";
import { Extraction } from "../db/models/Extraction.js";

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

router.get("/sessions/:sessionId/expiring", async (request, response, next) => {
  try {
    const { sessionId } = request.params;
    const withinDays = parseInt(
      typeof request.query.withinDays === "string" ? request.query.withinDays : "90",
      10
    );

    if (Number.isNaN(withinDays) || withinDays < 1) {
      response.status(400).json({
        error: "INVALID_PARAMETER",
        message: "withinDays must be a positive integer."
      });
      return;
    }

    const session = await Session.findByPk(sessionId);
    if (!session) {
      response.status(404).json({
        error: "SESSION_NOT_FOUND",
        message: "The specified session was not found."
      });
      return;
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const cutoff = new Date(today);
    cutoff.setUTCDate(cutoff.getUTCDate() + withinDays);

    // Database query — not an in-memory filter
    const expiring = await Extraction.findAll({
      where: {
        sessionId,
        status: "COMPLETE",
        expiryDate: {
          [Op.lte]: cutoff.toISOString().slice(0, 10),
          [Op.gte]: today.toISOString().slice(0, 10)
        }
      },
      order: [["expiryDate", "ASC"]]
    });

    const expired = await Extraction.findAll({
      where: {
        sessionId,
        status: "COMPLETE",
        isExpired: true
      },
      order: [["expiryDate", "ASC"]]
    });

    const todayStr = today.toISOString().slice(0, 10);

    const formatRow = (e: Extraction, isAlreadyExpired: boolean) => {
      const expiry = e.expiryDate ?? "";
      const expiryDate = new Date(expiry + "T00:00:00Z");
      const daysRemaining = Math.ceil(
        (expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
      );
      return {
        id: e.id,
        fileName: e.fileName,
        documentType: e.documentType,
        holderName: e.holderName,
        expiryDate: e.expiryDate,
        daysRemaining,
        isExpired: isAlreadyExpired,
        urgency: isAlreadyExpired ? "EXPIRED" : daysRemaining <= 30 ? "HIGH" : daysRemaining <= 60 ? "MEDIUM" : "LOW"
      };
    };

    const result = [
      ...expired.map(e => formatRow(e, true)),
      ...expiring.map(e => formatRow(e, false))
    ].sort((a, b) => (a.daysRemaining ?? 0) - (b.daysRemaining ?? 0));

    response.status(200).json({
      sessionId,
      withinDays,
      asOf: todayStr,
      count: result.length,
      documents: result
    });
  } catch (error) {
    next(error);
  }
});

export { router as sessionsRouter };
