import { VitestUtils } from "vitest";
import { destroy } from "../../src";
import { logger } from "../../src/util/logger";

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export const testLog = (message: string, ...args: unknown[]): void => {
  logger.debug(`[TEST] ${message}`, ...args);
}

export const resetTests = (vi?: VitestUtils) => {
  destroy();
  history.replaceState(null, '', '/');
  try { localStorage.removeItem('__trackkit_consent__'); } catch {}
  try { Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true }); } catch { (globalThis as any).doNotTrack = '0'; }
  delete (globalThis as any).__TRACKKIT_SSR_QUEUE__;
  vi?.clearAllMocks();
}
