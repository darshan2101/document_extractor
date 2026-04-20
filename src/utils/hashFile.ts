import { createHash } from "node:crypto";

export const hashFile = (buffer: Buffer): string =>
  createHash("sha256").update(buffer).digest("hex");
