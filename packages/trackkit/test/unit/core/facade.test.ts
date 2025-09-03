import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  init,
  track,
  pageview,
  identify,
  destroy,
  waitForReady,
  grantConsent,
  denyConsent,
  getFacade,
  hasQueuedEvents,
  flushIfReady,
} from '../../../src';
import { createStatefulMock } from '../../helpers/providers';
import { injectProviderForTests } from '../../../src/facade/singleton';
// import { getFacade } from '../../../src/facade/singleton';

describe('Trackkit Facade (core API)', () => {
  beforeEach(() => {
    destroy();
    vi.clearAllMocks();
    history.replaceState(null, '', '/');

    // 1) Reset DNT to "off" for tests that expect sends
    try {
      Object.defineProperty(window.navigator, 'doNotTrack', { value: '0', configurable: true });
    } catch {
      // fallback: some browsers use msDoNotTrack / doNotTrack on window
      (window as any).doNotTrack = '0';
    }

    // 2) Clear persisted consent so prior tests don't leak a status
    try { localStorage.removeItem('__trackkit_consent__'); } catch {}

    // 3) Clear SSR queue/global hooks if any
    delete (globalThis as any).__TRACKKIT_SSR_QUEUE__;
  });

  describe('init()', () => {
    it('creates and returns an analytics instance', async () => {
      const analytics = init({ autoTrack: false, consent: { disablePersistence: true } }); // avoid autotrack noise
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('track');
      expect(analytics).toHaveProperty('pageview');
      expect(analytics).toHaveProperty('identify');
      expect(analytics).toHaveProperty('destroy');
      grantConsent();
      await waitForReady();
      expect(getFacade()).toBe(analytics);
    });

    it('uses default options when none provided', async () => {
      init();
      grantConsent();
      await waitForReady();
      const facade = getFacade();
      expect(facade).toBeDefined();
    });
  });

  describe('Queueing & consent', () => {
    it('queues calls before init and flushes after provider ready + consent granted', async () => {
      // Calls BEFORE init
      track('early_event', { a: 1 });
      pageview(); // also queues
      expect(hasQueuedEvents()).toBe(true);

      const { stateful, provider } = await createStatefulMock();
      injectProviderForTests(stateful);

      // Init and attach a mock provider so we can assert deliveries
      init({
        autoTrack: false,
        trackLocalhost: true,
        domains: ['localhost'],
        doNotTrack: false,
        consent: { disablePersistence: true, initialStatus: 'pending' },
      });

      const facade = getFacade();
      console.warn('Facade provider after init:', facade?.getProvider()?.name);

      // Still queued until consent granted
      // await waitForReady(); // consent unresolved yet
      await new Promise(r => setTimeout(r, 0));
      expect(hasQueuedEvents()).toBe(true);

      // Grant consent => flush
      grantConsent();
      await waitForReady();
      await flushIfReady();
      await new Promise(r => setTimeout(r, 30));

      console.warn('Current provider:', provider.name);
      console.warn('Facade provider:', facade?.getProvider()?.name);

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
        consent: { disablePersistence: true, initialStatus: 'pending' },
      });
      const { stateful, provider } = await createStatefulMock();
      injectProviderForTests(stateful);
      denyConsent(); // policy: drop queued analytics

      await waitForReady();
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
      init({ autoTrack: false, trackLocalhost: true, consent: { disablePersistence: true, initialStatus: 'granted' } });
      const { stateful, provider } = await createStatefulMock();
      injectProviderForTests(stateful);

      await waitForReady();
      track('delegated_event', { value: 42 });
      pageview();
      identify('abc');

      await new Promise(r => setTimeout(r, 20));

      expect(provider.eventCalls.map(e => e.name)).toContain('delegated_event');
      expect(provider.pageviewCalls.length).toBeGreaterThanOrEqual(1);
      // identify payload shape depends on the mock; at least assert it was called:
      expect(provider.identifyCalls.length).toBeGreaterThan(0);
    });
  });

  describe('destroy()', () => {
    it('cleans up the instance and resets singleton state', async () => {
      init({ autoTrack: false, consent: { disablePersistence: true } });
      grantConsent();
      await waitForReady();
      destroy();
      expect(getFacade()).toBeNull();
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
