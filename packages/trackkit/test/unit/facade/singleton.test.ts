import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  init,
  getFacade,
  destroy,
  waitForReady,
  track,
  hasQueuedEvents,
  grantConsent,
  flushIfReady,
} from '../../../src';
import { createStatefulMock } from '../../helpers/providers';
import { injectProviderForTests } from '../../../src/facade/singleton';

describe('Singleton behavior', () => {
  beforeEach(() => {
    destroy();
    vi.clearAllMocks();
    history.replaceState(null, '', '/');

    try { Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true }); } catch { (window as any).doNotTrack = '0'; }
    try { localStorage.removeItem('__trackkit_consent__'); } catch {}
    delete (globalThis as any).__TRACKKIT_SSR_QUEUE__;
  });


  it('reuses the same internal instance after multiple init calls', async () => {
    init({ provider: 'noop', autoTrack: false, consent: { disablePersistence: true } });
    grantConsent();
    await waitForReady();
    const facade1 = getFacade();

    // Should not re-initialize a new facade
    init();
    await waitForReady();
    const facade2 = getFacade();

    expect(facade1).toBe(facade2);
  });

  it('creates a new instance after destroy', async () => {
    init({ autoTrack: false, consent: { disablePersistence: true } });
    grantConsent();
    await waitForReady();
    const first = getFacade();
    destroy();
    init({ autoTrack: false, consent: { disablePersistence: true } });
    grantConsent();
    await waitForReady();
    const second = getFacade();

    expect(first).not.toBeNull();
    expect(second).not.toBeNull();
    expect(first?.id).not.toBe(second?.id);
  });

  it('maintains instance across imports', async () => {
    init({ autoTrack: false, consent: { disablePersistence: true } });
    grantConsent();
    await waitForReady();
    const { getFacade: getFacadeAgain } = await import('../../../src');
    expect(getFacade()).toBe(getFacadeAgain());
  });

  it('exposes queue helpers that reflect pre-init calls and flush after consent', async () => {
    // Queue something before init
    track('early');
    expect(hasQueuedEvents()).toBe(true);

    // Init + attach a mock provider for observation
    const { stateful, provider } = await createStatefulMock();
    const { eventCalls } = provider.diagnostics;
    injectProviderForTests(stateful); // <-- inject BEFORE init

    init({
      autoTrack: false,
      trackLocalhost: true,
      domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'pending' },
    });

    // Provider is “ready” immediately for the injected mock; give it a tick
    await new Promise(r => setTimeout(r, 10));

    grantConsent();
    await waitForReady();          // provider ready + consent resolved

    await flushIfReady();
    await new Promise(r => setTimeout(r, 10));

    expect(eventCalls.map(e => e.name)).toEqual(['early']);
  });
});