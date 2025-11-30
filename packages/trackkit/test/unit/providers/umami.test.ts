/// <reference types="vitest" />
import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '../../setup/msw';
import { http, HttpResponse } from 'msw';
import type { PageContext } from '../../../src';
import { TEST_SITE_ID } from '../../helpers/providers';
import { resetTests } from '../../helpers/core';

// @vitest-environment jsdom

beforeAll(() => server.listen());
afterAll(() => server.close());

  beforeEach(() => {
    resetTests(vi);
  });

  afterEach(() => {
    resetTests(vi);
    server.resetHandlers()
  });

describe('Umami provider / client', () => {
  it('pageview maps ctx → payload (no window reads)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 202 })
    );

    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({ provider: { name: 'umami', website: TEST_SITE_ID.umami }});
    const ctx: PageContext = {
      url: '/a',
      title: 'T',
      referrer: '/prev',
      viewportSize: { width: 800, height: 600 },
      language: 'en-US',
      hostname: 'localhost',
      timestamp: 123,
    };

    instance.pageview(ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, options] = fetchSpy.mock.calls[0];
    const body = JSON.parse(options!.body as string);

    expect(body).toMatchObject({
      type: 'event',
      payload: {
        name: 'pageview',
        website: TEST_SITE_ID.umami,
        url: '/a',
        title: 'T',
        referrer: '/prev',
        screen: '800x600',
        language: 'en-US',
        hostname: 'localhost',
      },
    });

    fetchSpy.mockRestore();
  });

  it('track maps event + props → payload', async () => {
    let captured: any;
    server.use(
      http.post('*', async ({ request }) => {
        captured = await request.json();
        return HttpResponse.json({ ok: true });
      })
    );

    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({ provider: { name: 'umami', website: TEST_SITE_ID.umami } });

    // Provide ctx with an explicit url + viewport to avoid 0x0 defaults
    const ctx: PageContext = {
      url: '/page',
      referrer: '',
      viewportSize: { width: 1, height: 1 },
    };

    await instance.track('button_click', { button_id: 'cta-hero', value: 42 }, ctx);

    expect(captured).toMatchObject({
      type: 'event',
      payload: {
        website: TEST_SITE_ID.umami,
        name: 'button_click',
        url: '/page',
        data: { button_id: 'cta-hero', value: 42 },
      },
    });
  });

  it('uses custom host when provided', async () => {
    let postUrl = '';
    server.use(
      http.post('*', ({ request }) => {
        postUrl = request.url;
        return HttpResponse.json({ ok: true });
      })
    );

    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { 
        name: 'umami',
        website: TEST_SITE_ID.umami,
        host: 'https://analytics.example.com',
      }
    });

    await instance.track('test', {}, { url: '/', viewportSize: { width: 1, height: 1 } });

    expect(postUrl).toContain('analytics.example.com');
  });

  it('rejects on network failure', async () => {
    server.use(
      http.post('*', () => new HttpResponse(null, { status: 500, statusText: 'Internal Server Error' }))
    );

    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({ provider: { name: 'umami', website: TEST_SITE_ID.umami } });

    await expect(
      instance.track('oops', {}, { url: '/', viewportSize: { width: 1, height: 1 } })
    ).rejects.toThrow(/(Provider request failed|500)/);
  });

  it('adds cache-busting param when cache=true (transport-level)', async () => {
    server.use(
      http.post('*', () => {
        return HttpResponse.json({ ok: true });
      })
    );

    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: { bustCache: true },
    });

    const sendBeaconSpy = vi.fn(() => true);
    Object.defineProperty(global.navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
    });

    await instance.track('test', { value: 42 }, { url: '/', viewportSize: { width: 1, height: 1 } });

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    // @ts-expect-error
    const [urlArg] = sendBeaconSpy.mock.calls[0];
    expect(urlArg).toContain('?cache=');
  });

  it('adds no-store headers when cache=true and using fetch', async () => {
    // Ensure no beacon so AUTO → fetch
    Object.defineProperty(global.navigator, 'sendBeacon', {
      value: undefined,
      configurable: true,
    });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response(null, { status: 204 }));

    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: { bustCache: true },
    });
    await instance.track('test', { value: 42 }, { url: '/', viewportSize: { width: 1, height: 1 } });

    const [, init] = fetchSpy.mock.calls[0];
    expect((init!.headers as Record<string, string>)['Cache-Control']).toBe('no-store, max-age=0');
    expect((init!.headers as Record<string, string>).Pragma).toBe('no-cache');
  });


  it('identify is a safe no-op', async () => {
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({ provider: { name: 'umami', website: TEST_SITE_ID.umami }});
    const ctx: PageContext = {
        url: '/a',
        title: 'T',
        referrer: '/prev',
        viewportSize: { width: 800, height: 600 },
        language: 'en-US',
        hostname: 'localhost',
        timestamp: 123,
      };
    expect(() => instance.identify('user-123', ctx)).not.toThrow();
  });

  it('destroy() is idempotent', async () => {
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({ provider: { name: 'umami', website: TEST_SITE_ID.umami }});
    expect(() => instance.destroy()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
  });
});
