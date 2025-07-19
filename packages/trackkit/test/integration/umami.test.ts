/// <reference types="vitest" />
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { server } from '../setup-msw';
import { http, HttpResponse } from 'msw';
import { init, track, setConsent, destroy, waitForReady } from '../../src';

// @vitest-environment jsdom

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  destroy();
});
afterAll(() => server.close());

describe('Umami Integration', () => {
  // it('sends events after initialization', async () => {
  //   let requests: any[] = [];
  //   server.use(
  //     http.post('https://cloud.umami.is/api/send', async ({ request }) => {
  //       requests.push(await request.json());
  //       return HttpResponse.json({ ok: true });
  //     })
  //   );
    
  //   // Initialize with Umami
  //   init({
  //     provider: 'umami',
  //     siteId: 'test-site-id',
  //     autoTrack: false, // Disable auto pageview for test
  //   });
    
  //   // Wait for provider to be ready
  //   await waitForReady();
    
  //   // Grant consent
  //   setConsent('granted');
    
  //   // Track events
  //   track('test_event', { value: 42 });
  //   pageview('/test-page');
    
  //   // Wait for async requests
  //   await new Promise(resolve => setTimeout(resolve, 200));
    
  //   expect(requests).toHaveLength(2);
  //   expect(requests[0]).toMatchObject({
  //     name: 'test_event',
  //     data: { value: 42 },
  //   });
  //   expect(requests[1]).toMatchObject({
  //     url: '/test-page',
  //   });
  // });
  
  it('queues events before provider ready', async () => {
    let requests: any[] = [];
    server.use(
      http.post('*', async ({ request }) => {
        console.warn("Intercepted request to Umami API", request);
        requests.push(await request.json());
        return HttpResponse.json({ ok: true });
      })
    );

    // Track before init
    track('early_event');  // <-- When this is uncommented, the post is not sent, and the test fails.

    // Initialize
    init({
      provider: 'umami',
      siteId: 'test-site',
      autoTrack: false,
      cache: false,
    });
    
    // Grant consent
    setConsent('granted');
    
    // Track after init but possibly before ready
    track('quick_event');
    track('next_event');
    
    // Wait for everything to process
    const analytics = await waitForReady();

    analytics.track('final_event');


    await new Promise(resolve => setTimeout(resolve, 200));

    
    // Both events should be sent
    const eventNames = requests
      .filter(r => r.name)
      .map(r => r.name);

    console.warn("Event names sent:", eventNames);

    // expect(eventNames).toContain('early_event');  // <-- Even when this is commented out, tracking before init causes the test to fail.
    expect(eventNames).toContain('quick_event');
  });
  
  // it('handles provider switching gracefully', async () => {
  //   let umamiRequests = 0;
  //   server.use(
  //     http.post('*', () => {
  //       console.warn('Posting to Mock Umami API');
  //       umamiRequests++;
  //       return new HttpResponse(null, { status: 204 });
  //     })
  //   );

  //   // vi.spyOn(globalThis, 'fetch').mockImplementation((...args) => {
  //   //   console.log("Intercepted fetch", args);
  //   //   return Promise.resolve(new Response('{}', { status: 200 }));
  //   // });

  //   // Start with no-op
  //   init({ provider: 'noop' });
  //   await waitForReady();
  //   track('noop_event');

  //   // Assert that no requests were sent for the no-op provider
  //   expect(umamiRequests).toBe(0);
    
  //   // Destroy and switch to Umami
  //   destroy();
    
  //   init({
  //     provider: 'umami',
  //     siteId: 'test-site',
  //     autoTrack: false,
  //     cache: true,
  //   });
  //   await waitForReady();
    
  //   setConsent('granted');
  //   track('umami_event');
    
  //   await new Promise(resolve => setTimeout(resolve, 100));

  //   // Only Umami event should be sent
  //   expect(umamiRequests).toBe(1);
  // });
});
