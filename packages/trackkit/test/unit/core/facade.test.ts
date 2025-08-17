import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  init,
  getInstance,
  track,
  pageview,
  identify,
  destroy,
  waitForReady,
  grantConsent,
  denyConsent,
  hasQueuedEvents,
  flushIfReady,
} from '../../../src';
import { createStatefulMock } from '../../helpers/providers';
import { getFacade } from '../../../src/core/facade-singleton';

describe('Trackkit Facade (core API)', () => {
  beforeEach(() => {
    destroy();
    vi.clearAllMocks();
  });

  describe('init()', () => {
    it('creates and returns an analytics instance', async () => {
      const analytics = init({ autoTrack: false }); // avoid extra pageview noise
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('track');
      expect(analytics).toHaveProperty('pageview');
      expect(analytics).toHaveProperty('identify');
      expect(analytics).toHaveProperty('destroy');

      const ready = await waitForReady();
      expect(ready).toBeDefined();
    });

    it('uses default options when none provided', async () => {
      const analytics = init();
      expect(analytics).toBeDefined();
      await waitForReady();
    });
  });

  describe('getInstance()', () => {
    it('returns null before initialization', () => {
      expect(getInstance()).toBeNull();
    });

    it('returns a provider wrapper after initialization', async () => {
      init({ autoTrack: false });
      await waitForReady();
      expect(getInstance()).toBeTruthy();
    });

    it('returns null after destroy()', () => {
      init({ autoTrack: false });
      destroy();
      expect(getInstance()).toBeNull();
    });
  });

  describe('Queueing & consent', () => {
    it('queues calls before init and flushes after provider ready + consent granted', async () => {
      // Call BEFORE init
      track('early_event', { a: 1 });
      pageview(); // will queue too
      expect(hasQueuedEvents()).toBe(true);

      // Init and attach a mock provider so we can assert deliveries
      init({
        autoTrack: false,
        trackLocalhost: true,
        consent: { disablePersistence: true },
      });
      const { stateful, provider } = await createStatefulMock();
      getFacade().setProvider(stateful);

      // Still queued until consent granted
      await waitForReady();
      expect(hasQueuedEvents()).toBe(true);

      // Grant consent => flush
      grantConsent();
      await flushIfReady();
      await new Promise(r => setTimeout(r, 30));

      // Both queued calls delivered
      expect(provider.eventCalls.map(e => e.name)).toEqual(['early_event']);
      expect(provider.pageviewCalls.length).toBe(1);
    });

    it('drops queued events when consent is denied', async () => {
      // Pre-init calls
      track('will_be_dropped');
      pageview();

      init({
        autoTrack: false,
        trackLocalhost: true,
        consent: { disablePersistence: true },
      });
      const { stateful, provider } = await createStatefulMock();
      getFacade().setProvider(stateful);
      await waitForReady();

      denyConsent(); // policy: drop queued analytics
      await flushIfReady();
      await new Promise(r => setTimeout(r, 30));

      expect(provider.eventCalls.length).toBe(0);
      expect(provider.pageviewCalls.length).toBe(0);
    });
  });

  describe('Module-level methods', () => {
    it('safely handles calls before initialization (no throws)', () => {
      expect(() => track('test')).not.toThrow();
      expect(() => pageview()).not.toThrow();
      expect(() => identify('user123')).not.toThrow();
    });

    it('delegates to the facade after initialization', async () => {
      init({ autoTrack: false, trackLocalhost: true });
      const { stateful, provider } = await createStatefulMock();
      getFacade().setProvider(stateful);

      await waitForReady();
      grantConsent();

      track('delegated_event', { value: 42 });
      pageview();
      identify('abc');

      await new Promise(r => setTimeout(r, 20));

      expect(provider.eventCalls.map(e => e.name)).toContain('delegated_event');
      expect(provider.pageviewCalls.length).toBeGreaterThanOrEqual(1);
      expect(provider.identifyCalls.pop()).toBe('abc');
    });
  });

  describe('destroy()', () => {
    it('cleans up the instance and resets singleton state', async () => {
      init({ autoTrack: false });
      const analytics = await waitForReady();
      const spy = vi.spyOn(analytics, 'destroy');

      destroy();

      expect(spy).toHaveBeenCalledTimes(1);
      expect(getInstance()).toBeNull();
    });

    it('is safe to call multiple times', async () => {
      init({ autoTrack: false });
      expect(() => {
        destroy();
        destroy();
        destroy();
      }).not.toThrow();
    });
  });
});