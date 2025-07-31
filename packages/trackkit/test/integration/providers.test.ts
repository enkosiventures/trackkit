/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '../setup-msw';
import { http, HttpResponse } from 'msw';
import { init, track, destroy, waitForReady, grantConsent, pageview, ProviderType } from '../../src';
import { debugLog } from '../../src/util/logger';
import { TEST_SITE_ID } from '../setup-umami';

// @vitest-environment jsdom

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  destroy();
});
afterAll(() => server.close());

describe('Provider Integration', () => {
  const providers: Array<{ 
    name: string; 
    config: any;
  }> = [
    {
      name: 'umami',
      config: { provider: 'umami', siteId: TEST_SITE_ID },
    },
    {
      name: 'plausible',
      config: { provider: 'plausible', siteId: 'test.com' },
    },
    {
      name: 'ga4',
      config: { provider: 'ga', siteId: 'G-TEST123456' },
    },
  ];

  beforeEach(() => {
    destroy();
  })

  providers.forEach(({ name, config }) => {
    it(`${name} sends events after initialization`, async () => {
      const payloads = {
        umami: [
          {
            payload: {
              website: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
              hostname: 'localhost',
              screen: '0x0',
              name: 'test_event',
              data: { value: 42 },
            },
            type: 'event'
          },
          {
            payload: {
              website: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
              hostname: 'localhost',
              screen: '0x0',
              url: '/test-page'
            },
            type: 'pageview'
          }
        ],
        plausible: [
          { name: 'test_event', props: { value: "42" } },
          { url: '/test-page' }
        ],
        ga4: [
          {
            client_id: expect.stringMatching(/^\d+\.[a-z0-9]+$/),
            timestamp_micros: expect.any(Number),
            non_personalized_ads: false,
            events:  [
              {
                name: 'test_event',
                params: {
                  session_id: expect.any(String),
                  engagement_time_msec: 100,
                  value: 42
                }
              }
            ]
          },
          {
            client_id: expect.stringMatching(/^\d+\.[a-z0-9]+$/),
            timestamp_micros: expect.any(Number),
            non_personalized_ads: false,
            events: [
              {
                name: 'page_view',
                params: {
                  session_id: expect.any(String),
                  engagement_time_msec: 100,
                  page_location: '/test-page',
                  page_referrer: '',
                  page_title: '',
                  language: 'en-US',
                  screen_resolution: '1024x768'
                }
              }
            ]
          }
        ]
      }
      let requests: any[] = [];
      server.use(
        http.post('*', async ({ request }) => {
          debugLog('Intercepted request to ${name} API');
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
      track('test_event', { value: 42 });
      pageview('/test-page');
      
      // Wait for async requests
      await new Promise(resolve => setTimeout(resolve, 200));

      console.warn('Captured requests:', requests[0].events);
      console.warn('Captured requests:', requests[1].events);
      
      expect(requests).toHaveLength(2);
      expect(requests[0]).toMatchObject(payloads[name][0]);
      expect(requests[1]).toMatchObject(payloads[name][1]);
    });
    
    it(`${name} queues events before provider ready`, async () => {
      let requests: any[] = [];
      server.use(
        http.post('*', async ({ request }) => {
          debugLog('Intercepted request to ${name} API');
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

      console.warn('Captured requests:', requests);
      console.warn('Captured event names:', eventNames);
      expect(eventNames).toContain('quick_event');
      expect(eventNames).toContain('next_event');
      expect(eventNames).toContain('final_event');
    });

    it(`${name} handles provider switching gracefully`, async () => {
      let requests = 0;
      server.use(
        http.post('*', () => {
          console.warn('Posting to Mock API');
          requests++;
          return new HttpResponse(null, { status: 204 });
        })
      );

      // Start with no-op
      init({ provider: 'noop' });
      await waitForReady();
      track('noop_event');

      // Assert that no requests were sent for the no-op provider
      expect(requests).toBe(0);

      // Destroy and switch to Umami
      destroy();
      
      init({
        ...config,
        autoTrack: false,
        trackLocalhost: true,
        cache: true,
      });
      await waitForReady();
      
      grantConsent();
      track('provider_event');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Only Umami event should be sent
      expect(requests).toBe(1);
    });
  });
});
