import { pino } from "pino";

const logger = pino({ name: "queue-worker" });

export const startWorker = (): void => {
  logger.info("Queue worker stub initialized.");
};
