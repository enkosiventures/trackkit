import type { Mock, VitestUtils } from "vitest";
import { vi } from "vitest";
import { destroy } from "../../src";
import { logger } from "../../src/util/logger";
import { STORAGE_KEY } from "../../src/constants";

export const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

export const microtick = () => Promise.resolve();

export const getMockCall = (mock: Mock) => mock.mock.calls[0][0];

export const testLog = (message: string, ...args: unknown[]): void => {
  logger.debug(`[TEST] ${message}`, ...args);
}

export const resetTests = (vi?: VitestUtils) => {
  destroy();
  history.replaceState(null, '', '/');
  try { localStorage.removeItem(STORAGE_KEY); } catch {}
  try { Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true }); } catch { (globalThis as any).doNotTrack = '0'; }
  delete (globalThis as any).__TRACKKIT_SSR_QUEUE__;
  vi?.clearAllMocks();
}

// Flush pending timers *and* any follow-up microtasks those timers schedule
export const flushTimers = async () => {
  // Vitest has async helpers; prefer them if available
  // They run timers, then yield to the microtask queue.
  // If your Vitest version lacks these, see the fallback below.
  // @ts-expect-error - on older versions this may not exist; you'll use the fallback
  if (vi.runAllTimersAsync) {
    // run only what you scheduled so far; no infinite loops
    await vi.runOnlyPendingTimersAsync?.();
  } else {
    // Fallback: advance a big chunk then yield to microtasks
    vi.advanceTimersByTime(10_000);
    await microtick();
  }
  // One extra microtick to catch nested promises scheduled by the timer callback
  await microtick();
};
