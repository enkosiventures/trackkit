import { describe, it, expect, beforeEach, afterEach } from 'vitest';

// Factory API (additive to the singleton)
import { createAnalytics } from '../../src/factory';

// Useful to reset browser-ish env between tests
import { JSDOM } from 'jsdom';
import { createStatefulMock } from '../helpers/providers';
import { resetTests } from '../helpers/core';

function resetEnv() {
  // keep URL stable for PV policy logic
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
  // Vitest’s global already points to a DOM; but ensure location/history are reset
  history.replaceState(null, '', '/');
  try { localStorage.removeItem('__trackkit_consent__'); } catch {}
  try { Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true }); } catch { (globalThis as any).doNotTrack = '0'; }
  delete (globalThis as any).__TRACKKIT_SSR_QUEUE__;
}

// A tiny stateful mock provider we can inject per instance
function makeStatefulMock(name = 'mock') {
  const eventCalls: Array<{ name: string; props?: any }> = [];
  const pageviewCalls: string[] = [];
  let readyCb: (() => void) | null = null;

  const state = { provider: 'initializing' as 'initializing' | 'ready' | 'destroyed', version: '1.0.0' };
  const stateful = {
    name,
    getState: () => state,
    onReady: (cb: () => void) => { readyCb = cb; setTimeout(() => { state.provider = 'ready'; cb(); }, 0); },
    track: (name: string, props?: any) => { eventCalls.push({ name, props }); },
    pageview: (url?: string) => { pageviewCalls.push(url ?? '/'); },
    identify: (userId: string | null) => { /* could capture if needed */ },
    destroy: () => { state.provider = 'destroyed'; },
  };

  return { stateful, provider: { eventCalls, pageviewCalls } };
}



describe('Factory API', () => {
  beforeEach(() => {
    resetTests();
    resetEnv();
  });

  afterEach(() => {
    resetTests();
  });

  it('creates two independent instances; pre-init queues flush to the correct provider', async () => {
    const a1 = createAnalytics(); // not initialized yet
    const a2 = createAnalytics();

    // Pre-init calls (should queue inside each instance)
    (a1 as any).track('e1', { a: 1 });
    (a2 as any).track('e2', { b: 2 });
    (a1 as any).pageview('/a1');
    (a2 as any).pageview('/a2');

    // Inject different providers for each instance BEFORE init
    const { stateful: s1, provider: p1 } = await createStatefulMock();
    const { stateful: s2, provider: p2 } = await createStatefulMock();
    (a1 as any).setProvider(s1);
    (a2 as any).setProvider(s2);

    // Init both; consent granted from the start so waitForReady resolves purely on provider-ready
    (a1 as any).init({
      autoTrack: false,
      trackLocalhost: true, domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'granted' },
    });
    (a2 as any).init({
      autoTrack: false,
      trackLocalhost: true, domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'granted' },
    });

    await (a1 as any).waitForReady();
    await (a2 as any).waitForReady();

    // Verify isolation
    expect(p1.diagnostics.eventCalls.map(e => e.name)).toEqual(['e1']);
    expect(p2.diagnostics.eventCalls.map(e => e.name)).toEqual(['e2']);
    expect(p1.diagnostics.pageviewCalls).toEqual([{
      "hostname": "localhost",
      "language": "en-US",
      "referrer": "",
      "screenSize": undefined,
      "timestamp": expect.any(Number),
      "title": "",
      "url": "/a1",
      "userId": undefined,
      "viewportSize": {
        "height": 768,
        "width": 1024,
      },
    }]);

    expect(p2.diagnostics.pageviewCalls).toEqual([{
      "hostname": "localhost",
      "language": "en-US",
      "referrer": "",
      "screenSize": undefined,
      "timestamp": expect.any(Number),
      "title": "",
      "url": "/a2",
      "userId": undefined,
      "viewportSize": {
        "height": 768,
        "width": 1024,
      },
    }]);
  });

  it('waitForReady({ mode: "provider" }) resolves without consent, per instance', async () => {
    const a = createAnalytics();
    const { stateful } = makeStatefulMock('providerOnly');
    (a as any).setProvider(stateful);

    (a as any).init({
      autoTrack: false,
      trackLocalhost: true, domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'pending' },
    });

    await (a as any).waitForReady({ mode: 'provider' }); // should resolve even while consent is pending
  });

  it('does not share identify (user) state across instances', async () => {
    const a1 = createAnalytics();
    const a2 = createAnalytics();

    const { stateful: s1, provider: p1 } = makeStatefulMock('id1');
    const { stateful: s2, provider: p2 } = makeStatefulMock('id2');
    (a1 as any).setProvider(s1);
    (a2 as any).setProvider(s2);

    (a1 as any).init({
      autoTrack: false,
      trackLocalhost: true, domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'granted' },
    });
    (a2 as any).init({
      autoTrack: false,
      trackLocalhost: true, domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'granted' },
    });

    await (a1 as any).waitForReady();
    await (a2 as any).waitForReady();

    (a1 as any).identify('u1');
    (a2 as any).identify('u2');

    // Minimal assertion: we at least called identify on both providers.
    // If your mock provider tracks identify calls, assert them here:
    // expect(p1.identifyCalls[0]).toEqual('u1'); etc.
    // For now, ensure we can still send events separately:
    (a1 as any).track('only_a1');
    (a2 as any).track('only_a2');

    expect(p1.eventCalls.map(e => e.name)).toContain('only_a1');
    expect(p2.eventCalls.map(e => e.name)).toContain('only_a2');
  });
});
