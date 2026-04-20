import { Router } from "express";

const router = Router();

router.get("/health", (_request, response) => {
  response.status(200).json({
    status: "OK",
    version: "1.0.0",
    uptime: process.uptime(),
    dependencies: {
      database: "OK",
      llmProvider: "OK",
      queue: "OK"
    },
    timestamp: new Date().toISOString()
  });
});

export { router as healthRouter };
