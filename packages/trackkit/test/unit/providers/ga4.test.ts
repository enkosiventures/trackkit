/// <reference types="vitest" />
import { describe, it, expect, vi, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import type { PageContext } from '../../../src/types';
import { resetTests, tick } from '../../helpers/core';
import { mockSender } from '../../helpers/providers';
import { makeDispatcherSender } from '../../../src/providers/base/transport';
import { applyBatchingDefaults, applyResilienceDefaults } from '../../../src/facade/normalize';
import { server } from '../../setup/msw';
import { http, HttpResponse } from 'msw';


// ───────────────────────────────────────────────────────────────────────────────
// Shared helpers
// ───────────────────────────────────────────────────────────────────────────────
const makeCtx = (over: Partial<PageContext> = {}): PageContext => ({
  url: '/page',
  referrer: '',
  title: 'Title',
  language: 'en-US',
  viewportSize: { width: 1024, height: 768 },
  screenSize: { width: 1920, height: 1080 },
  timestamp: Date.now(),
  ...over,
});

// ───────────────────────────────────────────────────────────────────────────────
// Group 1: Mapping & endpoint tests (mock the transport)
// ───────────────────────────────────────────────────────────────────────────────
describe('GA4 client (mapping & endpoints)', () => {
  let createGA4Client: typeof import('../../../src/providers/ga4/client').createGA4Client;

  const getFirstReq = () => {
    // help TS: treat calls as any[][]
    const calls = mockSender.send.mock.calls as unknown as any[][];
    expect(calls.length).toBeGreaterThan(0); // makes intent clear
    return calls[0][0] as { url: string; method: string; body: unknown };
  };

  beforeAll(async () => {
    // Import after mocks are set
    ({ createGA4Client } = await import('../../../src/providers/ga4/client'));
  });

  beforeEach(() => {
    mockSender.send.mockClear();
    resetTests(vi);
  });

  afterEach(() => {
    resetTests(vi);
  });

  it('requires measurementId', () => {
    // @ts-expect-error intentionally missing
    expect(() => createGA4Client({})).toThrow(/measurementId/i);
    expect(() => createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    })).not.toThrow();
  });

  it('builds default endpoint with measurementId', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    });
    await c.track('evt', {}, makeCtx());
    const { url, method, body } = getFirstReq();
    expect(url).toContain('https://www.google-analytics.com/mp/collect');
    expect(url).toContain('measurement_id=G-TEST123');
    expect(method).toBe('AUTO');
    expect(body).toHaveProperty('client_id');
    expect(body).toHaveProperty('events');
  });

  it('uses debug endpoint when debugEndpoint=true', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123', debugEndpoint: true },
      factory: { sender: mockSender },
    });
    await c.pageview(makeCtx({ url: '/x' }));
    const { url } = getFirstReq();
    expect(url).toContain('/debug/mp/collect');
  });

  it('includes apiSecret when provided', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123', apiSecret: 'shh' },
      factory: { sender: mockSender },
    });
    await c.track('evt', {}, makeCtx());
    const { url } = getFirstReq();
    expect(url).toContain('api_secret=shh');
  });

  it('honors host override', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123', host: 'https://ga-proxy.example.com/' },
      factory: { sender: mockSender },
    });
    await c.track('evt', {}, makeCtx());
    const { url } = getFirstReq();
    expect(url.startsWith('https://ga-proxy.example.com/mp/collect?')).toBe(true);
  });

  it('maps pageview params from PageContext', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    });
    await c.pageview(makeCtx({ url: '/a?x=1', referrer: '/prev', title: 'Title A', language: 'pl', screenSize: { width: 800, height: 600 } }));
    const { body } = getFirstReq();
    const payload = body as any;

    expect(payload).toMatchObject({
      client_id: expect.stringMatching(/^\d+\.\d+$/),
      events: [{
        name: 'page_view',
        params: expect.objectContaining({
          page_location: '/a?x=1',
          page_referrer: '/prev',
          page_title: 'Title A',
          language: 'pl',
          screen_resolution: '800x600',
          session_id: expect.any(Number),
          engagement_time_msec: 100,
        }),
      }],
    });
  });

  it('maps custom event with props + context', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    });
    await c.track('signup', { plan: 'pro', value: 42 }, makeCtx({ url: '/signup' }));

    const { body } = getFirstReq();
    const payload = body as any;
    const params = payload.events[0].params;

    expect(payload.events[0].name).toBe('signup');
    expect(params.plan).toBe('pro');
    expect(params.value).toBe(42);
    expect(params.page_location).toBe('/signup');
    expect(params.session_id).toEqual(expect.any(Number));
  });

  it('sets engagement_time_msec when missing', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    });
    await c.track('evt', {}, makeCtx());
    const { body } = getFirstReq();
    expect((body as any).events[0].params.engagement_time_msec).toBe(100);
  });

  it('keeps same session_id across calls in a run', async () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    });
    await c.track('evt1', {}, makeCtx({ url: '/1' }));
    await c.track('evt2', {}, makeCtx({ url: '/2' }));

    const calls = mockSender.send.mock.calls as unknown as any[][];
    const sid1 = (calls[0][0].body as any).events[0].params.session_id;
    const sid2 = (calls[1][0].body as any).events[0].params.session_id;
    expect(sid1).toBe(sid2);
  });

  it('identify() and destroy() are safe no-ops', () => {
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    });
    const ctx: PageContext = {
      url: '/a',
      title: 'T',
      referrer: '/prev',
      viewportSize: { width: 800, height: 600 },
      language: 'en-US',
      hostname: 'localhost',
      timestamp: 123,
    };
    expect(() => c.identify('user-1', ctx)).not.toThrow();
    expect(() => c.identify(null, ctx)).not.toThrow();
    expect(() => c.destroy()).not.toThrow();
    expect(() => c.destroy()).not.toThrow();
  });

  it('throws on non-OK responses', async () => {
    mockSender.send.mockResolvedValueOnce(new Response('bad', { status: 400, statusText: 'Bad' }));
    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender: mockSender },
    });
    await expect(c.track('oops', {}, makeCtx())).rejects.toThrow(/\[ga4] request failed: 400/i);
  });
});

// ───────────────────────────────────────────────────────────────────────────────
// Group 2: Transport behavior tests (real transport; no transport mock)
// ───────────────────────────────────────────────────────────────────────────────
describe('GA4 client (transport behavior)', () => {
  let createGA4Client: typeof import('../../../src/providers/ga4/client').createGA4Client;

  beforeAll(() => server.listen());
  afterAll(() => server.close());

  beforeEach(async () => {
    () => server.resetHandlers();
    // Ensure a clean module graph without the transport mock
    vi.resetModules();
    vi.doUnmock('../../../src/providers/base/transport');

    ({ createGA4Client } = await import('../../../src/providers/ga4/client'));
  });

  afterEach(() => {
    // @ts-ignore
    delete navigator.sendBeacon;
    vi.clearAllMocks();
  });

  it('uses fetch when navigator.sendBeacon is unavailable', async () => {
    const requests: any[] = [];
    server.use(http.post('*', async ({ request }) => {
      requests.push(request);
      return HttpResponse.json({});
    }));

    const sender = makeDispatcherSender({
      batching: applyBatchingDefaults(),
      resilience: applyResilienceDefaults(),
      bustCache: false,
      defaultHeaders: { 'Content-Type': 'application/json' },
      transportMode: 'smart',
    });

    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender },
    });
    await c.pageview(makeCtx({ url: '/fallback' }));

    await tick(100);
    expect(requests).toHaveLength(1);
    const {url, method} = requests[0];
    expect(url).toContain('/mp/collect?measurement_id=G-TEST123');
    expect(method).toBe('POST');
  });

  it('prefers beacon when available (returns 204) and does not call fetch', async () => {
    const beaconSpy = vi.fn().mockReturnValue(true);

    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconSpy,
      configurable: true,
      writable: true 
    });
    
    const requests: any[] = [];
    server.use(http.post('*', async ({ request }) => {
      requests.push(await request.json());
      return HttpResponse.json({});
    }));
    
    const sender = makeDispatcherSender({
      batching: applyBatchingDefaults(),
      resilience: {...applyResilienceDefaults(), detectBlockers: true },
      bustCache: false,
      defaultHeaders: { 'Content-Type': 'application/json' },
      transportMode: 'smart',
    })

    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender },
    });
    await c.pageview(makeCtx({ url: '/fallback' }));
    await c.track('evt', { a: 1 }, makeCtx());
    await tick(100);

    expect(beaconSpy).toHaveBeenCalledTimes(2);
    expect(requests).toHaveLength(0); // fetch not called

    const [beaconUrl, beaconBody] = beaconSpy.mock.calls[0];
    expect(String(beaconUrl)).toContain('/mp/collect?measurement_id=G-TEST123');

    // Don’t parse the body here—just assert we sent a JSON-ish blob.
    expect(beaconBody).toBeTruthy();
    // Safe, cross-realm checks:
    expect((beaconBody as any).type).toBe('application/json');
    expect(typeof (beaconBody as any).size).toBe('number');
    expect((beaconBody as any).size).toBeGreaterThan(10); // non-empty payload
  });

  it('falls back to fetch when beacon returns false', async () => {
    const beaconSpy = vi.fn().mockReturnValue(false);
    
    Object.defineProperty(navigator, 'sendBeacon', {
      value: beaconSpy,
      configurable: true,
      writable: true 
    });

    const requests: any[] = [];
    server.use(http.post('*', async ({ request }) => {
      requests.push(request);
      return HttpResponse.json({});
    }));

    const sender = makeDispatcherSender({
      batching: applyBatchingDefaults(),
      resilience: {...applyResilienceDefaults(), detectBlockers: true },
      bustCache: false,
      defaultHeaders: { 'Content-Type': 'application/json' },
      transportMode: 'smart',
    })

    const c = createGA4Client({
      provider: { name: 'ga4', measurementId: 'G-TEST123' },
      factory: { sender },
    });
    await c.pageview(makeCtx({ url: '/beacon-fallback' }));
    await tick(100);

    expect(requests).toHaveLength(1);
    console.warn('Requests received:', requests);
    const { url, method } = requests[0];
    expect(url).toContain('/mp/collect?measurement_id=G-TEST123');
    expect(method).toBe('POST');

    expect(beaconSpy).toHaveBeenCalledTimes(1);
  });
});
