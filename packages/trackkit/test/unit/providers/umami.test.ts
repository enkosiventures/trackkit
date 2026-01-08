/// <reference types="vitest" />
import { describe, it, expect, vi, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '../../setup/msw';
import { http, HttpResponse } from 'msw';
import type { PageContext } from '../../../src';
import { getMockCall, mockSender, TEST_SITE_ID } from '../../helpers/providers';
import { resetTests } from '../../helpers/core';
import { makeDispatcherSender, Sender } from '../../../src/providers/base/transport';
import { applyBatchingDefaults, applyResilienceDefaults } from '../../../src/facade/normalize';
import { DEFAULT_HEADERS, DEFAULT_TRANSPORT_MODE } from '../../../src/constants';

// @vitest-environment jsdom

beforeAll(() => server.listen());
afterAll(() => server.close());

  beforeEach(() => {
    mockSender.send.mockClear();
    resetTests(vi);
  });

  afterEach(() => {
    resetTests(vi);
    server.resetHandlers()
  });

describe('Umami provider / client', () => {
  it('pageview maps ctx → payload (no window reads)', async () => {
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: { bustCache: false, debug: false, sender: mockSender },
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

    instance.pageview(ctx);

    expect(mockSender.send).toHaveBeenCalledTimes(1);

    expect(getMockCall(mockSender).body).toMatchObject({
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
  });

  it('track maps event + props → payload', async () => {
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });

    // Provide ctx with an explicit url + viewport to avoid 0x0 defaults
    const ctx: PageContext = {
      url: '/page',
      referrer: '',
      viewportSize: { width: 1, height: 1 },
    };

    await instance.track(
      'button_click',
      { button_id: 'cta-hero', value: 42 },
      ctx,
    );

    expect(getMockCall(mockSender).body).toMatchObject({
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
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { 
        name: 'umami',
        website: TEST_SITE_ID.umami,
        host: 'https://analytics.example.com',
      },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });

    await instance.track(
      'test',
      {},
      { url: '/', viewportSize: { width: 1, height: 1 } },
    );

    expect(getMockCall(mockSender).url).toContain('analytics.example.com');
  });


  it('maps non-ok responses from sender into provider errors', async () => {
    const failingSender: Sender = {
      type: 'smart',
      override: false,
      send: async () =>
      new Response('boom', { status: 500, statusText: 'Internal Server Error' })
    };

    const umami = (await import('../../../src/providers/umami')).default;

    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: {
        bustCache: false,
        debug: false,
        sender: failingSender,
      },
    });

    await expect(
      instance.track('oops', {}, { url: '/', viewportSize: { width: 1, height: 1 } })
    ).rejects.toThrow(/(Provider request failed|500)/);
  });

  it('does not reject on HTTP 500 when using dispatcher sender (best-effort path)', async () => {
    server.use(
      http.post('*', () => new HttpResponse(null, {
        status: 500,
        statusText: 'Internal Server Error',
      }))
    );

    const sender = makeDispatcherSender({
      batching: applyBatchingDefaults(),
      resilience: applyResilienceDefaults(),
      bustCache: false,
      transportMode: DEFAULT_TRANSPORT_MODE,
      defaultHeaders: DEFAULT_HEADERS,
    });

    const umami = (await import('../../../src/providers/umami')).default;

    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: {
        bustCache: false,
        debug: false,
        sender,
      },
    });

    await expect(
      instance.track('oops', {}, { url: '/', viewportSize: { width: 1, height: 1 } })
    ).resolves.toBeUndefined();
  });

  it('adds cache-busting param when cache=true (transport-level)', async () => {
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: { bustCache: true, debug: true, sender: mockSender },
    });

    await instance.track('test', { value: 42 }, { url: '/', viewportSize: { width: 1, height: 1 } });

    expect(mockSender.send).toHaveBeenCalledTimes(1);
    expect(getMockCall(mockSender).bustCache).toBe(true);
  });

  it('identify is a safe no-op', async () => {
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: { bustCache: false, debug: false, sender: mockSender },
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
    expect(() => instance.identify('user-123', ctx)).not.toThrow();
  });

  it('destroy() is idempotent', async () => {
    const umami = (await import('../../../src/providers/umami')).default;
    const instance = umami.create({
      provider: { name: 'umami', website: TEST_SITE_ID.umami },
      factory: { bustCache: false, debug: false, sender: mockSender },
    });
    expect(() => instance.destroy()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
  });
});
