/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import plausible from '../../../src/providers/plausible';
import type { PageContext } from '../../../src/types';
import { resetTests, getMockCall } from '../../helpers/core';


const mockSender = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));

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
    resetTests(vi);
    mockSender.mockClear();
  });

  afterEach(() => {
    resetTests(vi);
  });

  // --- defaults / validation ---

  it('throws when domain is missing', () => {
    expect(() => plausible.create({ provider: {} as any, factory: {}})).toThrow('[plausible] "domain" is required');
  });

  it('normalizes host (default + custom, stripping trailing slashes)', async () => {
    const p1 = plausible.create({
      provider: { domain: 'example.com' } as any,
      factory: { sender: mockSender }
    });
    await p1.pageview(ctx());
    expect(mockSender).toHaveBeenCalledTimes(1);
    expect(getMockCall(mockSender)).toMatchObject({
      url: 'https://plausible.io/api/event',
      method: 'AUTO',
    });

    mockSender.mockClear();

    const p2 = plausible.create({
      provider: { domain: 'example.com', host: 'https://analytics.example.com///' } as any,
      factory: { sender: mockSender }
    });
    await p2.pageview(ctx());
    expect(mockSender).toHaveBeenCalledTimes(1);
    expect(getMockCall(mockSender)).toMatchObject({
      url: 'https://analytics.example.com/api/event',
      method: 'AUTO',
    });
  });

  // --- pageview mapping ---

  it('maps pageview payload from PageContext', async () => {
    const instance = plausible.create({
      provider: { domain: 'example.com' } as any,
      factory: { sender: mockSender },
    });
    await instance.pageview(
      ctx({
        url: '/a?x=1#h',
        referrer: '/prev',
        title: 'Title A',
      })
    );

    const req = getMockCall(mockSender);
    expect(req.url).toBe('https://plausible.io/api/event');
    expect(req.method).toBe('AUTO');
    expect(req.maxBeaconBytes).toBe(64_000);

    const body = req.body;
    expect(body).toEqual({
      name: 'pageview',
      url: '/a?x=1#h',
      referrer: '/prev',
      domain: 'example.com',
      props: {
        "page_title": "Title A",
      },
    });
  });

  it('omits optional fields when absent on pageview', async () => {
    const instance = plausible.create({
      provider: { domain: 'example.com' } as any,
      factory: { sender: mockSender },
    });
    await instance.pageview(ctx({ url: '/only-url', referrer: undefined, title: undefined }));

    const body = getMockCall(mockSender).body;
    expect(body).toEqual({
      name: 'pageview',
      url: '/only-url',
      domain: 'example.com',
    });
  });

  // --- event mapping ---

  it('maps event payload with props + referrer', async () => {
    const instance = plausible.create({
      provider: { domain: 'example.com' } as any,
      factory: { sender: mockSender }
    });
    await instance.track('Signup', { plan: 'pro' }, ctx({ url: '/u', referrer: '/r' }));

    const body = getMockCall(mockSender).body;
    expect(body).toEqual({
      name: 'Signup',
      url: '/u',
      referrer: '/r',
      domain: 'example.com',
      props: { plan: 'pro' },
    });
  });

  it('omits props when empty', async () => {
    const instance = plausible.create({
      provider: { domain: 'example.com' } as any,
      factory: { sender: mockSender },
    });
    await instance.track('Ping', {}, ctx({ url: '/u' }));

    const body = getMockCall(mockSender).body;
    expect(body).toEqual({
      name: 'Ping',
      url: '/u',
      domain: 'example.com',
    });
  });

  // --- revenue mapping ---

  it('maps revenue when trackingEnabled and props.revenue is an object; removes revenue from props', async () => {
    const instance = plausible.create({
      provider: {
        domain: 'example.com',
        revenue: { currency: 'EUR', trackingEnabled: true },
      } as any,
      factory: { sender: mockSender },
    });

    const props = { plan: 'pro', revenue: { value: 2999, currency: 'USD' } };
    await instance.track('Purchase', { ...props }, ctx({ url: '/checkout' }));

    const body = getMockCall(mockSender).body;
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
      provider: {
        domain: 'example.com',
        revenue: { currency: 'GBP', trackingEnabled: true },
      } as any,
      factory: { sender: mockSender },
    });

    await instance.track('Purchase', { revenue: { value: 1000 } } as any, ctx({ url: '/c' }));

    const body = getMockCall(mockSender).body;
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
      provider: {
        domain: 'example.com',
        revenue: { currency: 'USD', trackingEnabled: false },
      } as any,
      factory: { sender: mockSender },
    });

    await instance.track('Purchase', { revenue: { value: 1234, currency: 'USD' }, foo: 1 } as any, ctx({ url: '/c' }));

    const body = getMockCall(mockSender).body;
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
    const instance = plausible.create({
      provider: { domain: 'example.com' } as any,
      factory: { sender: mockSender },
    });
    await instance.track('Event', { a: 1 }, ctx({ url: '/x' }));
    expect(getMockCall(mockSender).maxBeaconBytes).toBe(64_000);
  });

  it('identify and destroy are safe no-ops', () => {
    const instance = plausible.create({
      provider: { domain: 'example.com' } as any,
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
    expect(() => instance.identify('abc', ctx)).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow(); // idempotent
  });

  // (Optional) show that adapter propagates non-ok responses via parseError
  it('rejects when transport response is not ok', async () => {
    mockSender.mockResolvedValueOnce(new Response('nope', { status: 500, statusText: 'Server Error' }));
    const instance = plausible.create({
      provider: { domain: 'example.com' } as any,
      factory: { sender: mockSender }
    });
    await expect(instance.track('Bad', {}, ctx({ url: '/err' }))).rejects.toThrow(
      /Provider request failed: 500 Server Error/i
    );
  });
});
