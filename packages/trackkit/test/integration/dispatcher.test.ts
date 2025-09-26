import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  destroy, track as trackGlobal, pageview as pageviewGlobal,
  flushIfReady as flushGlobal,
} from '../../src';
import { setupAnalytics, type TestProvider } from '../helpers/providers';
import type { AnalyticsMode } from '../../src/types';
import { AnalyticsFacade } from '../../src/facade';


function testAPI(mode: AnalyticsMode, facade?: AnalyticsFacade) {
  return {
    pageview: (...a: any[]) => (mode === 'factory' ? facade!.pageview(...a) : pageviewGlobal(...a)),
    // @ts-expect-error
    track:    (...a: any[]) => (mode === 'factory' ? facade!.track(...a) : trackGlobal(...a)),
    flush:    () => (mode === 'factory' ? facade!.flushIfReady() : flushGlobal()),
    destroy:  () => (mode === 'factory' ? facade!.destroy() : destroy()),
  };
}

class FlakyProvider implements TestProvider {
  name = 'flaky';
  attempts = 0;
  events: string[] = [];
  diagnostics: Record<string, any> = {
    attempts: 0,
    events: [] as string[],
  };
  async _init(): Promise<void> {
    // Simulate async work
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  pageview() { return Promise.resolve(); }
  track(name: string) {
    this.diagnostics.events.push(name);
    this.diagnostics.attempts++;
    if (this.diagnostics.attempts < 3) {
      const e: any = new Error('temporary');
      e.status = 503; // retryable by batch processor
      throw e;
    }
    return Promise.resolve();
  }
  identify() {}
  destroy() {}
}

// small helper
const runTimers = async (ms: number) => { vi.advanceTimersByTime(ms); await vi.runOnlyPendingTimersAsync(); };

describe('Dispatcher integration (facade wiring)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    (globalThis as any).navigator = { ...(globalThis as any).navigator, doNotTrack: '0' };
  });
  afterEach(async () => {
    await destroy();
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  (['factory', 'singleton'] as AnalyticsMode[]).forEach(mode => {

    it(`${mode} sends immediately when batching is disabled`, async () => {
      const { facade, provider } = await setupAnalytics(
        {
          autoTrack: false,
          trackLocalhost: true,
          consent: { initialStatus: 'granted', disablePersistence: true },
          batching: { enabled: false },
        },
        { mode }
      );

      const api = testAPI(mode, facade);

      api.track('instant-1');
      api.pageview('/instant');

      // no timers advanced; should have sent already
      const { eventCalls, pageviewCalls } = provider!.diagnostics;
      expect(eventCalls.map(e => e.name)).toEqual(['instant-1']);
      expect(pageviewCalls.map(p => p.url)).toEqual(['/instant']);
    });

    it(`${mode} holds events until maxWait when batching is enabled, then flushes on the timer`, async () => {
      const { facade, provider } = await setupAnalytics(
        {
          autoTrack: false,
          trackLocalhost: true,
          consent: { initialStatus: 'granted', disablePersistence: true },
          batching: { enabled: true, maxWait: 50 },
        },
        { mode }
      );

      const api = testAPI(mode, facade);
      api.track('A');
      api.track('B');

      const { eventCalls } = provider!.diagnostics;

      // Not yet flushed
      expect(eventCalls.length).toBe(0);

      // Let batch timer fire and microtasks settle
      await runTimers(51);

      // Flush deterministically to await in-flight work (public API)
      await api.flush();

      expect(eventCalls.map(e => e.name)).toEqual(['A', 'B']);
    });

    it(`${mode} - flushIfReady flushes pending batched events without waiting for the timer`, async () => {
      const { facade, provider } = await setupAnalytics(
        {
          autoTrack: false,
          trackLocalhost: true,
          consent: { initialStatus: 'granted', disablePersistence: true },
          batching: { enabled: true, maxWait: 10_000 }, // long timer
        },
        { mode }
      );

      const api = testAPI(mode, facade);

      api.track('manually-flushed');

      const { eventCalls } = provider!.diagnostics;

      // No timer advanced; should still be queued
      expect(eventCalls.length).toBe(0);

      await api.flush();

      expect(eventCalls.map(e => e.name)).toEqual(['manually-flushed']);
    });

    it(`${mode} - destroy() cancels scheduled batch — nothing should send after destroy`, async () => {
      const { facade, provider } = await setupAnalytics(
        {
          autoTrack: false,
          trackLocalhost: true,
          consent: { initialStatus: 'granted', disablePersistence: true },
          batching: { enabled: true, maxWait: 50 },
        },
        { mode }
      );

      const api = testAPI(mode, facade);

      api.track('zombie');
      // Destroy before timer fires
      await api.destroy();

      // Advance timers aggressively; nothing should send
      await runTimers(1_000);

      const { eventCalls, pageviewCalls } = provider!.diagnostics;
      expect(eventCalls.length).toBe(0);
      expect(pageviewCalls.length).toBe(0);
    });

    // -------- Optional: enable once facade wires retry/backoff through init() --------
    it(`${mode} retries provider failures with backoff via facade config`, async () => {
      const { facade, provider } = await setupAnalytics(
        {
          provider: 'noop',
          autoTrack: false,
          trackLocalhost: true,
          consent: { initialStatus: 'granted', disablePersistence: true },
          batching: { enabled: true, maxWait: 1, retry: { maxAttempts: 3, initialDelay: 5, jitter: false } },
        },
        { mode, providerOverride: new FlakyProvider() }
      );

      const api = testAPI(mode, facade);

      api.track('will-retry');

      // Advance timers to allow 2 retries then success
      await vi.runOnlyPendingTimersAsync(); // first send
      vi.advanceTimersByTime(10); await vi.runOnlyPendingTimersAsync(); // 1st retry
      vi.advanceTimersByTime(20); await vi.runOnlyPendingTimersAsync(); // 2nd retry


      await api.flush();

      const { attempts, events } = provider!.diagnostics;
      expect(attempts).toBe(3);
      expect(events).toEqual(['will-retry', 'will-retry', 'will-retry']);
    });
  });
});
