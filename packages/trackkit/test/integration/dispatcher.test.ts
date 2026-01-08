import { server } from '../setup/msw';
import { http, HttpResponse } from 'msw';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { setupAnalytics } from '../helpers/providers';
import { tick } from '../helpers/core';

describe('Dispatcher integration', () => {
  beforeAll(() => server.listen());
  afterAll(() => server.close());
  beforeEach(() => server.resetHandlers());

  it('flushes when maxSize is exceeded', async () => {
    const requests: any[] = [];
    server.use(http.post('*', async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({});
    }));

    const { facade } = await setupAnalytics({
      provider: { name: 'plausible', domain: 'test.com' },
      autoTrack: false,
      dispatcher: { 
        // Large maxWait to avoid timer flush interference
        batching: { enabled: true, maxSize: 2, maxWait: 50000 },
        performance: { enabled: true },
      },
      trackLocalhost: true,
      consent: { initialStatus: 'granted' },
    }, {
      withMockProvider: false,
    });


    await facade!.waitForReady();

    facade!.track('A', { i: 1 });
    facade!.track('B', { i: 2 });
    await tick(100);

    // Does not flush when maxSize reached
    expect(requests).toHaveLength(0);

    facade!.track('C', { i: 3 });
    await tick(100);

    const diag = facade!.getDiagnostics();
    console.warn('Diagnostics:', diag);
    console.warn('Events', diag.provider.events);
    console.warn('History', diag.provider.history);

    console.warn('Requests:', requests);
    expect(requests).toHaveLength(2);
  });

  it('flushes pending batch on maxWait and stops after destroy', async () => {
    const requests: any[] = [];
    server.use(http.post('*', async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({});
    }));

    const { facade } = await setupAnalytics({
      provider: { name: 'plausible', domain: 'test.com' },
      autoTrack: false,
      dispatcher: { 
        // Large maxWait to avoid timer flush interference
        batching: { enabled: true, maxSize: 10, maxWait: 100 },
        performance: { enabled: true },
      },
      trackLocalhost: true,
      consent: { initialStatus: 'granted' },
    }, {
      withMockProvider: false,
    });

    facade!.track('T1', { a: 1 });
    await tick(95);
    expect(requests).toHaveLength(0);

    await tick(10);
    expect(requests).toHaveLength(1);

    facade!.destroy();
    facade!.track('T2', { a: 2 });
    await tick(200);
    expect(requests).toHaveLength(1);
  });

  it('retries transient failures', async () => {
    let hits = 0;
    server.use(http.post('*', () => {
      hits += 1;
      if (hits === 1) return HttpResponse.json({}, { status: 503 });
      return HttpResponse.json({});
    }));

    const { facade } = await setupAnalytics({
      provider: { name: 'plausible', domain: 'test.com' },
      autoTrack: false,
      dispatcher: {
        batching: { enabled: true, maxSize: 1, maxWait: 0 },
        resilience: { retry: { maxAttempts: 2, initialDelay: 5, maxDelay: 5, multiplier: 1, jitter: false } },
      },
      trackLocalhost: true,
      consent: { initialStatus: 'granted' },
    }, {
      withMockProvider: false,
    });

    await facade!.track('retry-me');
    await tick(100);
    expect(hits).toBe(2);
  });

  it('applies cache-busting headers for POST', async () => {
    let observedHeaders: Headers | null = null;
    server.use(http.post('*', async ({ request }) => {
      console.warn('Observing request headers:', request.headers);
      observedHeaders = request.headers;
      return HttpResponse.json({});
    }));

    const { facade } = await setupAnalytics({
      provider: { name: 'plausible', domain: 'test.com' },
      autoTrack: false,
      bustCache: true,
      dispatcher: {
        performance: { enabled: true },
      },
      trackLocalhost: true,
      consent: { initialStatus: 'granted' },
    }, {
      withMockProvider: false,
    });

    await facade!.track('cache');
    await tick(50);
    // @ts-expect-error
    expect(observedHeaders?.get('cache-control')).toBe('no-store, max-age=0');
  });
});
