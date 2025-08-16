/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
import { server } from '../setup/msw';
import { http, HttpResponse } from 'msw';
import { init, track, destroy, waitForReady, grantConsent, pageview } from '../../src';
import { debugLog } from '../../src/util/logger';
import { TEST_SITE_ID } from '../setup/providers';
import { UMAMI_ENDPOINT, UMAMI_HOST } from '../../src/constants';
// import { installBeaconPolyfill } from '../setup/install-beacon-polyfill';


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
      config: { provider: 'umami', site: TEST_SITE_ID.umami },
      data: { url: `${UMAMI_HOST}${UMAMI_ENDPOINT}` }
    },
    {
      name: 'plausible',
      config: { provider: 'plausible', site: 'test.com' },
      data: { url: 'https://plausible.io/api/event' }
    },
    {
      name: 'ga4',
      config: { provider: 'ga4', site: 'G-TEST123456' },
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
      history.pushState({}, '', '/test-page');
      track('test_event', { value: 42 });
      pageview();
      
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
        http.post(data.url, () => {
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

      // Destroy and switch to real provider
      debugLog('[TEST] Destroying no-op provider');
      destroy();
      
      debugLog('[TEST] Switching to provider:', name);
      init({
        ...config,
        autoTrack: false,
        trackLocalhost: true,
        cache: true,
      });
      await waitForReady();
      
      grantConsent();
      debugLog('[TEST] Switched to provider:', name);
      track('provider_event');
      
      await new Promise(resolve => setTimeout(resolve, 100));

      // Only real provider event should be sent
      console.warn('Captured requests:', requests);
      expect(requests).toBe(1);
    });
  });
});

// /// <reference types="vitest" />
// import { describe, it, expect, beforeAll, afterAll, afterEach, beforeEach } from 'vitest';
// import { server, captured, clearCaptured } from '../setup/msw';
// import { installBeaconPolyfill } from '../setup/install-beacon-polyfill';
// import { init, track, destroy, waitForReady, grantConsent, pageview } from '../../src';
// import { TEST_SITE_ID } from '../setup/umami';

// // @vitest-environment jsdom

// beforeAll(() => {
//   installBeaconPolyfill();
//   server.listen();
// });

// afterEach(() => {
//   clearCaptured();
//   destroy();
//   server.resetHandlers(); // restore baseline handlers from setup/msw.ts
// });

// afterAll(() => server.close());

// describe('Provider Integration', () => {
//   const providers: Array<{
//     name: 'umami' | 'plausible' | 'ga4';
//     config: Record<string, any>;
//   }> = [
//     {
//       name: 'umami',
//       config: { provider: 'umami', site: TEST_SITE_ID.umami, host: 'https://api.umami.is' },
//     },
//     {
//       name: 'plausible',
//       config: { provider: 'plausible', site: 'test.com', host: 'https://plausible.io' },
//     },
//     {
//       // IMPORTANT: include apiSecret so GA4 actually sends
//       name: 'ga4',
//       config: { provider: 'ga4', site: 'G-TEST123456', apiSecret: 'secret' },
//     },
//   ];

//   beforeEach(() => {
//     clearCaptured();
//     destroy();
//     // set a stable URL for page context
//     history.replaceState({}, '', '/test-page');
//   });

//   providers.forEach(({ name, config }) => {
//     it(`${name} sends events after initialization`, async () => {
//       init({
//         ...config,
//         trackLocalhost: true,
//         autoTrack: false, // avoid implicit page_view
//         transport: 'fetch',
//       });

//       await waitForReady();
//       grantConsent();

//       // Send one custom event + one pageview
//       track('test_event', { value: 42 });
//       pageview();

//       // give the transport time to flush
//       await new Promise((r) => setTimeout(r, 200));

//       if (name === 'umami') {
//         // two posts to */api/send captured in captured.umami
//         expect(captured.umami.length).toBe(2);
//         const names = captured.umami.map((b) => b?.payload?.name).filter(Boolean);
//         expect(names).toEqual(['test_event', 'pageview']);

//         // sanity checks
//         expect(captured.umami[0]?.payload?.website).toBe(TEST_SITE_ID.umami);
//         expect(captured.umami[1]?.payload?.website).toBe(TEST_SITE_ID.umami);
//       }

//       if (name === 'plausible') {
//         // two posts to */api/event captured in captured.plausible
//         expect(captured.plausible.length).toBe(2);
//         const names = captured.plausible.map((b) => b?.name).filter(Boolean);
//         expect(names).toEqual(['test_event', 'pageview']);

//         expect(captured.plausible[0]?.domain).toBe('test.com');
//         expect(captured.plausible[1]?.domain).toBe('test.com');
//       }

//       if (name === 'ga4') {
//         // two posts to */mp/collect captured in captured.ga4
//         expect(captured.ga4.length).toBe(2);

//         // each body should contain an events array with a single event
//         const eventNames = captured.ga4
//           .map((x) => x?.body?.events?.[0]?.name)
//           .filter(Boolean);

//         // track -> 'test_event', pageview -> 'page_view'
//         expect(eventNames).toEqual(['test_event', 'page_view']);

//         // query params recorded by the handler
//         expect(captured.ga4[0]?.query?.measurement_id).toBe('G-TEST123456');
//         expect(captured.ga4[0]?.query?.api_secret).toBe('secret');
//       }
//     });

//     it(`${name} queues events before provider ready`, async () => {
//       // queue before init
//       track('early_event');

//       init({
//         ...config,
//         trackLocalhost: true,
//         autoTrack: false,
//         cache: false,
//         transport: 'fetch',
//       });

//       // race: fire more events before ready/consent
//       track('quick_event');
//       track('next_event');

//       await waitForReady();
//       grantConsent();

//       track('final_event');

//       await new Promise((r) => setTimeout(r, 250));

//       if (name === 'umami') {
//         const names = captured.umami.map((b) => b?.payload?.name).filter(Boolean);
//         // We only assert presence, not order
//         expect(names).toContain('quick_event');
//         expect(names).toContain('next_event');
//         expect(names).toContain('final_event');
//       }

//       if (name === 'plausible') {
//         const names = captured.plausible.map((b) => b?.name).filter(Boolean);
//         expect(names).toContain('quick_event');
//         expect(names).toContain('next_event');
//         expect(names).toContain('final_event');
//       }

//       if (name === 'ga4') {
//         const names = captured.ga4.map((x) => x?.body?.events?.[0]?.name).filter(Boolean);
//         expect(names).toContain('quick_event');
//         expect(names).toContain('next_event');
//         expect(names).toContain('final_event');
//       }
//     });

//     it(`${name} handles provider switching gracefully`, async () => {
//       // Start with noop; should NOT hit network
//       init({ provider: 'noop' });
//       await waitForReady();
//       track('noop_event');

//       // snapshots of counts before switching
//       const before = {
//         umami: captured.umami.length,
//         plausible: captured.plausible.length,
//         ga4: captured.ga4.length,
//       };

//       // Switch to real provider
//       destroy();
//       init({
//         ...config,
//         autoTrack: false,
//         trackLocalhost: true,
//         cache: true,
//         transport: 'fetch',
//       });
//       await waitForReady();
//       grantConsent();

//       track('provider_event');
//       await new Promise((r) => setTimeout(r, 150));

//       if (name === 'umami') {
//         const sent = captured.umami.length - before.umami;
//         expect(sent).toBe(1);
//       }

//       if (name === 'plausible') {
//         const sent = captured.plausible.length - before.plausible;
//         expect(sent).toBe(1);
//       }

//       if (name === 'ga4') {
//         const sent = captured.ga4.length - before.ga4;
//         expect(sent).toBe(1);
//       }
//     });
//   });
// });
