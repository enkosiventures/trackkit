import { logger } from "../../src/util/logger";

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export const testLog = (message: string, ...args: unknown[]): void => {
  logger.debug(`[TEST] ${message}`, ...args);
}
