import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkDispatcher } from '../../src/dispatcher/network-dispatcher';
import * as TransportsMod from '../../src/dispatcher/transports';
import { flushTimers, microtick } from '../helpers/core';
import { applyBatchingDefaults, applyDispatcherDefaults, applyResilienceDefaults } from '../../src/facade/normalize';
import { DEFAULT_HEADERS, FACADE_BASE_DEFAULTS } from '../../src/constants';
import { NetworkDispatcherOptions } from '../../src/dispatcher';
import { DispatcherOptions } from '../../src/dispatcher/types';


export class SpyTransport implements TransportsMod.Transport {
  public id = `mock_${Math.random().toString(36).slice(2)}`;
  send = vi.fn(async (_: {url: string, body: unknown, init?: RequestInit}) => {});
}

/**
 * A minimal provider used by integration tests.
 * - Immediately records calls (pageview/track)
 * - Uses NetworkDispatcher for actual network I/O (batching/retries/timers)
 * - Exposes its dispatcher & transport for assertions
 */
export function makeSpyProvider(networkDispatcherOptions: NetworkDispatcherOptions) {
  const transport = new SpyTransport();

  // Force dispatcher to use our transport (no real network)
  const dispatcher = new NetworkDispatcher(
    {...networkDispatcherOptions,
      transportOverride: transport,
    }
  );

  const diagnostics = {
    pageviewCalls: [] as Array<{ url: string }>,
    eventCalls: [] as Array<{ name: string; props: Record<string, unknown> }>,
  };

  return {
    diagnostics,
    __dispatcher: dispatcher,
    __transport: transport,

    // Trackkit ProviderInstance shape expected by the facade
    name: 'spy' as const,

    async pageview(_pageCtx: any) {
      diagnostics.pageviewCalls.push({ url: (typeof window !== 'undefined' ? location.href : '/') });
      await dispatcher.send({ url: 'https://api.test/collect', body: { type: 'pageview' } });
    },

    async track(name: string, props: Record<string, unknown>) {
      diagnostics.eventCalls.push({ name, props });
      await dispatcher.send({ url: 'https://api.test/collect', body: { type: 'event', name, props } });
    },

    identify(_userId: string | null) { /* noop */ },

    async flush() { await dispatcher.flush(); },

    destroy() { dispatcher.destroy(); },
  };
}


/**
 * Convenience helper used by tests that expect a ready facade with one spy provider.
 * Wire this into your existing setupAnalytics if you want, or use directly in the tests.
 */
export async function setupAnalyticsWithSpyProvider(
  createFacade: (providers: any[]) => any,
  dispatcherOptions?: DispatcherOptions,
  bustCache: boolean = FACADE_BASE_DEFAULTS.bustCache,
) {
  const resolvedDispatcherOptions = applyDispatcherDefaults(dispatcherOptions);
  const networkDispatcherOpts = {
    batching: resolvedDispatcherOptions.batching,
    resilience: resolvedDispatcherOptions.resilience,
    defaultHeaders: resolvedDispatcherOptions.defaultHeaders,
    bustCache,
  }
  const spy = makeSpyProvider(networkDispatcherOpts);
  const api = createFacade([spy]);
  return { api, spy };
}

/**
 * Replace this with your project’s actual facade factory if available.
 * It must accept an array of ProviderInstances and return { track, pageview, flush, destroy }.
 */
function createFacade(providers: any[]) {
  return {
    async pageview(ctx?: any) {
      await Promise.all(providers.map((p) => p.pageview(ctx)));
    },
    async track(name: string, props: Record<string, unknown> = {}, ctx?: any) {
      await Promise.all(providers.map((p) => p.track(name, props, ctx)));
    },
    async flush() {
      await Promise.all(providers.map((p) => p.flush?.()));
    },
    destroy() {
      providers.forEach((p) => p.destroy?.());
    },
  };
}

describe('Dispatcher integration (facade ↔ provider NetworkDispatcher)', () => {
  let t: SpyTransport;

  beforeEach(() => {
    vi.useFakeTimers();
    t = new SpyTransport();
    vi.spyOn(TransportsMod, 'resolveTransport').mockReturnValue(t as any);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });


  it('provider is called immediately; size threshold flushes first batch; explicit flush sends remainder', async () => {
    const { api, spy } = await setupAnalyticsWithSpyProvider(createFacade, {
      batching: { enabled: true, maxSize: 2, maxWait: 5, concurrency: 2 },
    });

    // Two events → still no network because we wait either for the 3rd enqueue or the timer
    await api.track('A', { i: 1 });
    await api.track('B', { i: 2 });

    // Provider methods were invoked immediately:
    expect(spy.diagnostics.eventCalls.length).toBe(2);

    // No network yet (we haven’t crossed the threshold nor advanced timers)
    expect(spy.__transport.send.mock.calls.length).toBe(0);

    // The 3rd event splits & flushes the first batch (per-event sends ⇒ 2 calls)
    await api.track('C', { i: 3 });
    await microtick();

    expect(spy.__transport.send.mock.calls.length).toBe(2);
    const firstBodies = spy.__transport.send.mock.calls.slice(0, 2).map(([payload]) => payload.body);
    expect(firstBodies).toEqual(
      [{ type: 'event', name: 'A', props: { i: 1 } }, { type: 'event', name: 'B', props: { i: 2 } }]
    );

    // One event remains pending (C). Explicit flush should send it.
    await api.flush();
    expect(spy.__transport.send.mock.calls.length).toBe(3);
    const thirdBody = spy.__transport.send.mock.calls[2][0].body;
    expect(thirdBody).toEqual({ type: 'event', name: 'C', props: { i: 3 } });
  });

  it('timer (maxWait) flushes pending batch; destroy cancels scheduled flushes', async () => {
    const { api, spy } = await setupAnalyticsWithSpyProvider(createFacade, {
      batching: { enabled: true, maxSize: 10, maxWait: 100 },
    });

    await api.track('T1', { a: 1 });
    await microtick();

    // Immediate provider call, no network yet
    expect(spy.diagnostics.eventCalls.length).toBe(1);
    expect(spy.__transport.send.mock.calls.length).toBe(0);

    // Advance timer → should flush the pending batch (per-event send ⇒ +1)
    vi.advanceTimersByTime(100);
    await flushTimers();

    expect(spy.__transport.send.mock.calls.length).toBe(1);
    expect(spy.__transport.send.mock.calls[0][0].body).toEqual({ type: 'event', name: 'T1', props: { a: 1 } });

    // Schedule another event then destroy before timer fires
    await api.track('T2', { a: 2 });
    api.destroy();
    vi.advanceTimersByTime(100);
    await flushTimers();

    // No additional sends after destroy
    expect(spy.__transport.send.mock.calls.length).toBe(1);
  });

  it('retries transient failures according to policy', async () => {
    const { api, spy } = await setupAnalyticsWithSpyProvider(createFacade, {
      batching: {
        enabled: true,
        maxSize: 1, // immediate dispatch per send
        maxWait: 0,
      },
      resilience: {
        retry: {
          maxAttempts: 2,
          initialDelay: 5, // use non-zero so we can see the timer
          maxDelay: 5,
          multiplier: 1,
          jitter: false,
          retryableStatuses: [429, 503],
        },
      },
    });

    let first = true;
    spy.__transport.send.mockImplementation(async () => {
      if (first) {
        first = false;
        const e: any = new Error('temporary');
        e.status = 503;
        throw e;         // first attempt fails → schedules retry in 5ms
      }
      // second attempt succeeds
    });

    await api.track('R', { ok: true });
    await microtick();                 // let the first attempt happen

    // Now advance retry delay and flush
    vi.advanceTimersByTime(5);
    await flushTimers();

    expect(spy.__transport.send.mock.calls.length).toBe(2);
    expect(spy.__transport.send.mock.calls[0][0].body).toEqual({ type: 'event', name: 'R', props: { ok: true } });
    expect(spy.__transport.send.mock.calls[1][0].body).toEqual({ type: 'event', name: 'R', props: { ok: true } });
  });


  it('pageview path goes through provider + dispatcher the same way', async () => {
    const { api, spy } = await setupAnalyticsWithSpyProvider(createFacade, {
      batching: { enabled: true, maxSize: 2, maxWait: 50 },
    });

    await api.pageview({ url: '/home' });
    expect(spy.diagnostics.pageviewCalls.length).toBe(1);
    expect(spy.__transport.send.mock.calls.length).toBe(0);

    // timer flush
    vi.advanceTimersByTime(50);
    await flushTimers();

    expect(spy.__transport.send.mock.calls.length).toBe(1);
    expect(spy.__transport.send.mock.calls[0][0].body).toEqual({ type: 'pageview' });
  });
});
