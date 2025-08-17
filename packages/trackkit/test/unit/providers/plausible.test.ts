/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import plausible from '../../../src/providers/plausible';
import type { PageContext } from '../../../src/types';

// IMPORTANT: mock the adapter transport so we can capture calls deterministically
import * as transport from '../../../src/providers/base/transport';

vi.mock('../../../src/providers/base/transport', async () => {
  const actual = await vi.importActual<typeof import('../../../src/providers/base/transport')>(
    '../../../src/providers/base/transport'
  );
  return {
    ...actual,
    send: vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
  };
});

const sendMock = transport.send as unknown as Mock;

function ctx(overrides: Partial<PageContext> = {}): PageContext {
  return {
    url: '/page',
    referrer: '',
    title: 'Some Title',
    language: 'en-US',
    hostname: 'localhost',
    viewportSize: { width: 1024, height: 768 },
    timestamp: 1111,
    ...overrides,
  };
}

describe('Plausible provider (spec adapter)', () => {
  beforeEach(() => {
    sendMock.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // --- defaults / validation ---

  it('throws when domain is missing', () => {
    expect(() => plausible.create({} as any)).toThrow('[plausible] "domain" is required');
  });

  it('normalizes host (default + custom, stripping trailing slashes)', async () => {
    const p1 = plausible.create({ domain: 'example.com' } as any);
    await p1.pageview(ctx());
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      url: 'https://plausible.io/api/event',
      method: 'AUTO',
    });

    sendMock.mockClear();

    const p2 = plausible.create({ domain: 'example.com', host: 'https://analytics.example.com///' } as any);
    await p2.pageview(ctx());
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toMatchObject({
      url: 'https://analytics.example.com/api/event',
      method: 'AUTO',
    });
  });

  // --- pageview mapping ---

  it('maps pageview payload from PageContext', async () => {
    const instance = plausible.create({ domain: 'example.com' } as any);
    await instance.pageview(
      ctx({
        url: '/a?x=1#h',
        referrer: '/prev',
        title: 'Title A',
      })
    );

    const req = sendMock.mock.calls[0][0];
    expect(req.url).toBe('https://plausible.io/api/event');
    expect(req.method).toBe('AUTO');
    expect(req.maxBeaconBytes).toBe(64_000);

    const body = req.body;
    expect(body).toEqual({
      name: 'pageview',
      url: '/a?x=1#h',
      referrer: '/prev',
      page_title: 'Title A',
      domain: 'example.com',
    });
  });

  it('omits optional fields when absent on pageview', async () => {
    const instance = plausible.create({ domain: 'example.com' } as any);
    await instance.pageview(ctx({ url: '/only-url', referrer: undefined, title: undefined }));

    const body = sendMock.mock.calls[0][0].body;
    expect(body).toEqual({
      name: 'pageview',
      url: '/only-url',
      domain: 'example.com',
    });
  });

  // --- event mapping ---

  it('maps event payload with props + referrer', async () => {
    const instance = plausible.create({ domain: 'example.com' } as any);
    await instance.track('Signup', { plan: 'pro' }, ctx({ url: '/u', referrer: '/r' }));

    const body = sendMock.mock.calls[0][0].body;
    expect(body).toEqual({
      name: 'Signup',
      url: '/u',
      referrer: '/r',
      domain: 'example.com',
      props: { plan: 'pro' },
    });
  });

  it('omits props when empty', async () => {
    const instance = plausible.create({ domain: 'example.com' } as any);
    await instance.track('Ping', {}, ctx({ url: '/u' }));

    const body = sendMock.mock.calls[0][0].body;
    expect(body).toEqual({
      name: 'Ping',
      url: '/u',
      domain: 'example.com',
    });
  });

  // --- revenue mapping ---

  it('maps revenue when trackingEnabled and props.revenue is an object; removes revenue from props', async () => {
    const instance = plausible.create({
      domain: 'example.com',
      revenue: { currency: 'EUR', trackingEnabled: true },
    } as any);

    const props = { plan: 'pro', revenue: { value: 2999, currency: 'USD' } };
    await instance.track('Purchase', { ...props }, ctx({ url: '/checkout' }));

    const body = sendMock.mock.calls[0][0].body;
    expect(body).toEqual({
      name: 'Purchase',
      url: '/checkout',
      domain: 'example.com',
      props: { plan: 'pro' }, // revenue removed from props
      revenue: { value: 2999, currency: 'USD' },
    });
  });

  it('uses options.revenue.currency as a fallback when props.revenue.currency is missing', async () => {
    const instance = plausible.create({
      domain: 'example.com',
      revenue: { currency: 'GBP', trackingEnabled: true },
    } as any);

    await instance.track('Purchase', { revenue: { value: 1000 } } as any, ctx({ url: '/c' }));

    const body = sendMock.mock.calls[0][0].body;
    expect(body).toEqual({
      name: 'Purchase',
      url: '/c',
      domain: 'example.com',
      revenue: { value: 1000, currency: 'GBP' },
      props: {}, // stripped later by transport
    });
  });

  it('does not add revenue when tracking is disabled', async () => {
    const instance = plausible.create({
      domain: 'example.com',
      revenue: { currency: 'USD', trackingEnabled: false },
    } as any);

    await instance.track('Purchase', { revenue: { value: 1234, currency: 'USD' }, foo: 1 } as any, ctx({ url: '/c' }));

    const body = sendMock.mock.calls[0][0].body;
    expect(body).toEqual({
      name: 'Purchase',
      url: '/c',
      domain: 'example.com',
      props: {
        revenue: { value: 1234, currency: 'USD' },
        foo: 1,
      },
    });
  });

  // --- plumbing / misc ---

  it('passes maxBeaconBytes=64000 to transport (limits)', async () => {
    const instance = plausible.create({ domain: 'example.com' } as any);
    await instance.track('Event', { a: 1 }, ctx({ url: '/x' }));
    expect(sendMock.mock.calls[0][0].maxBeaconBytes).toBe(64_000);
  });

  it('identify and destroy are safe no-ops', () => {
    const instance = plausible.create({ domain: 'example.com' } as any);
    const ctx: PageContext = {
      url: '/a',
      title: 'T',
      referrer: '/prev',
      viewportSize: { width: 800, height: 600 },
      language: 'en-US',
      hostname: 'localhost',
      timestamp: 123,
    };
    expect(() => instance.identify('abc', ctx)).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow(); // idempotent
  });

  // (Optional) show that adapter propagates non-ok responses via parseError
  it('rejects when transport response is not ok', async () => {
    sendMock.mockResolvedValueOnce(new Response('nope', { status: 500, statusText: 'Server Error' }));
    const instance = plausible.create({ domain: 'example.com' } as any);
    await expect(instance.track('Bad', {}, ctx({ url: '/err' }))).rejects.toThrow(
      /Provider request failed: 500 Server Error/i
    );
  });
});
