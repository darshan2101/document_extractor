import { Router } from "express";

import { jobService } from "../services/jobService.js";

const router = Router();

router.get("/jobs/:jobId", async (request, response, next) => {
  try {
    const { jobId } = request.params;

    const jobStatus = await jobService.getJobWithStatus(jobId);

    if (!jobStatus) {
      response.status(404).json({
        error: "JOB_NOT_FOUND",
        message: "The specified job was not found."
      });
      return;
    }

    response.status(200).json(jobStatus);
  } catch (error) {
    next(error);
  }
});

export { router as jobsRouter };
