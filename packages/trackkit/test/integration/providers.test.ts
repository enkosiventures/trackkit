/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '../setup/msw';
import { http, HttpResponse } from 'msw';
import { init, track, destroy, waitForReady, grantConsent, pageview } from '../../src';
import { TEST_SITE_ID } from '../helpers/providers';
import { UMAMI_ENDPOINT, UMAMI_HOST } from '../../src/constants';
import { testLog } from '../helpers/core';


// @vitest-environment jsdom

beforeAll(() => {
  // installBeaconPolyfill();
  server.listen();
});
afterEach(() => {
  server.resetHandlers();
  destroy();
});
afterAll(() => server.close());

describe('Provider Integration', () => {
  const providers: Array<{
    name: string; 
    config: any;
    data: { url: string | RegExp };
  }> = [
    {
      name: 'umami',
      config: { provider: { name: 'umami', site: TEST_SITE_ID.umami }},
      data: { url: `${UMAMI_HOST}${UMAMI_ENDPOINT}` }
    },
    {
      name: 'plausible',
      config: { provider: { name: 'plausible', site: 'test.com' }},
      data: { url: 'https://plausible.io/api/event' }
    },
    {
      name: 'ga4',
      config: { provider: { name: 'ga4', site: 'G-TEST123456' }},
      data: { url: /https:\/\/www\.google-analytics\.com\/(?:debug\/)?mp\/collect/ }
    },
  ];

  beforeEach(() => {
    destroy();
  })

  providers.forEach(({ name, config, data }) => {
    it(`${name} sends events after initialization`, async () => {
      const payloads = {
        umami: [
          // track('test_event', { value: 42 })
          {
            type: 'event',
            payload: {
              website: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
              url: '/test-page',
              name: 'test_event',
              // Optional context fields if your facade maps them
              // Distinct user id only if identify() was called
              // id: expect.stringMatching(/^[a-z0-9-]+$/),
              data: { value: 42 },
            },
          },
          // pageview()
          {
            type: 'event',
            payload: {
              website: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
              url: '/test-page',
              name: 'pageview',
              // id: expect.stringMatching(/^[a-z0-9-]+$/), // only if identify() used
            },
          },
        ],

        plausible: [
          // track('test_event', { value: 42 })
          {
            name: 'test_event',
            url: '/test-page',
            domain: 'test.com',
            props: { value: 42 },       // NOT stringified
            // interactive: false,      // optional, only if you use it
            // revenue: { currency: 'USD', amount: 123.45 }, // optional
          },
          // pageview()
          {
            name: 'pageview',
            url: '/test-page',
            domain: 'test.com',
            // page_title: '',          // you can include if you map it
          },
        ],

        ga4: [
          // track('test_event', { value: 42 })
          {
            client_id: expect.stringMatching(/^\d+\.[a-z0-9]+$/i),
            // timestamp_micros: expect.any(Number),  // include only if you set it
            events: [
              {
                name: 'test_event',
                params: {
                  session_id: expect.any(Number),
                  engagement_time_msec: 100,
                  value: 42,
                  // Optionally echo page context for non-page_view events too:
                  // page_location: '/test-page',
                  // page_referrer: '',
                  // page_title: '',
                  // language: 'en-US',
                  // screen_resolution: '1024x768',
                },
              },
            ],
          },
          // pageview()
          {
            client_id: expect.stringMatching(/^\d+\.[a-z0-9]+$/i),
            // timestamp_micros: expect.any(Number),  // optional
            events: [
              {
                name: 'page_view',
                params: {
                  session_id: expect.any(Number),
                  engagement_time_msec: 100,
                  page_location: '/test-page', // recommended: full URL; path is acceptable if that’s your facade policy
                },
              },
            ],
          },
        ],
      };

      let requests: any[] = [];
      server.use(
        http.post('*', async ({ request }) => {
          testLog('Intercepted request to ${name} API');
          requests.push(await request.json());
          return HttpResponse.json({ ok: true });
        })
      );
      
      init({
        ...config,
        trackLocalhost: true,
        autoTrack: false, // Disable auto pageview for test
      });
      
      // Wait for provider to be ready
      await waitForReady();
      
      // Grant consent
      grantConsent();
      
      // Track events
      history.pushState({}, '', '/test-page');
      track('test_event', { value: 42 });
      pageview();
      
      // Wait for async requests
      await new Promise(resolve => setTimeout(resolve, 200));

      expect(requests).toHaveLength(2);
      expect(requests[0]).toMatchObject(payloads[name][0]);
      expect(requests[1]).toMatchObject(payloads[name][1]);
    });
    
    it(`${name} queues events before provider ready`, async () => {
      let requests: any[] = [];
      server.use(
        http.post('*', async ({ request }) => {
          testLog('Intercepted request to ${name} API');
          requests.push(await request.json());
          return HttpResponse.json({ ok: true });
        })
      );

      // Track before init
      track('early_event');

      // Initialize
      init({
        ...config,
        trackLocalhost: true,
        autoTrack: false,
        cache: false,
      });
      
      // Track after init but possibly before ready
      track('quick_event');
      track('next_event');
      
      // Wait for everything to process
      await waitForReady();
      grantConsent();

      track('final_event');

      await new Promise(resolve => setTimeout(resolve, 200));

      
      // Both events should be sent
      const eventNames = name === 'ga4' ?
        requests
        .filter(r => r.events[0]?.name)
        .map(r => r.events[0].name)
      : name == 'plausible' ?
        requests
          .filter(r => r.name)
          .map(r => r.name)
      : requests
        .filter(r => r.payload?.name)
        .map(r => r.payload.name);  

      expect(eventNames).toContain('quick_event');
      expect(eventNames).toContain('next_event');
      expect(eventNames).toContain('final_event');
    });

    it(`${name} handles provider switching gracefully`, async () => {
      let requests = 0;
      server.use(
        http.post(data.url, () => {
          requests++;
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Start with no-op
      init();
      await waitForReady();
      track('noop_event');

      // Assert that no requests were sent for the no-op provider
      expect(requests).toBe(0);

      // Destroy and switch to real provider
      testLog('[TEST] Destroying no-op provider');
      destroy();
      
      testLog('[TEST] Switching to provider:', name);
      init({
        ...config,
        autoTrack: false,
        trackLocalhost: true,
        cache: true,
      });
      await waitForReady();
      
      grantConsent();
      testLog('[TEST] Switched to provider:', name);
      track('provider_event');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Only real provider event should be sent
      expect(requests).toBe(1);
    });
  });
});
