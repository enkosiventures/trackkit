import { test, expect } from '@playwright/test';


test.describe('Umami Provider E2E', () => {
  test.beforeEach(async ({ page }) => {
    // 0. Pipe browser logs to terminal for easier debugging
    page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));

    // 1. Mock Umami endpoint to capture requests without sending real data
    await page.route('**/api/send', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });
    
    // 2. Load fixture
    await page.goto('/test/fixtures/umami.html');

    // 3. Ensure SDK is loaded
    await page.waitForFunction(() => typeof (window as any).Trackkit !== 'undefined');
  });
  
  test('sends pageview on load (programmatic)', async ({ page }) => {
    // Setup listener before triggering action
    const requestPromise = page.waitForRequest(req => req.url().includes('/api/send'));

    // Initialize in browser context
    await page.evaluate(() => {
      const { createAnalytics } = (window as any).Trackkit;
      const site = '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b';
      const analytics = createAnalytics({
        provider: {
          name: 'umami',
          site, 
          host: 'https://analytics.example.com',
        },
        trackLocalhost: true,
      });

      analytics.grantConsent();
      analytics.pageview();
    });
    
    const request = await requestPromise;
    const data = request.postDataJSON();

    expect(data.payload.website).toBe('9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b');
    expect(data.payload.url).toEqual(expect.stringContaining('/test/fixtures/umami'));
  });
  
  test('tracks custom events with data', async ({ page }) => {
    const requestPromise = page.waitForRequest(req => req.url().includes('/api/send'));
    
    await page.evaluate(() => {
      const { createAnalytics } = (window as any).Trackkit;
      const analytics = createAnalytics({
        provider: {
          name: 'umami',
          site: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
          host: 'https://analytics.example.com',
        },
        trackLocalhost: true,
        autoTrack: false,
      });
      
      analytics.grantConsent();
      analytics.track('button_click', { tier: 'premium' });
    });
    
    const request = await requestPromise;
    const body = request.postDataJSON();
    console.warn("Body:", body);
    
    expect(body.type).toBe('event');
    expect(body.payload).toMatchObject({
      name: 'button_click',
      data: { tier: 'premium' }
    });
  });

  test('successfully sends beacon on transport close (unload)', async ({ page }) => {
    let receivedPayload: any = null;
    
    await page.route('**/api/send', async (route) => {
       receivedPayload = route.request().postDataJSON();
       await route.fulfill({ status: 200, headers: { 'Access-Control-Allow-Origin': '*' } }); // Helper for CORS
    });

    await page.evaluate(async () => {
      const { createAnalytics } = (window as any).Trackkit;
      const analytics = createAnalytics({
        provider: {
          name: 'umami',
          site: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
          host: 'https://analytics.example.com',
        },
        trackLocalhost: true,
        autoTrack: false,
        dispatcher: { 
          // 1. Queue events
          batching: { enabled: true, maxSize: 10, maxWait: 5000 },
          // 2. Ensure reliability
          transportMode: 'fetch', 
        },
      });

      await analytics.waitForReady();
      analytics.grantConsent();
      analytics.track('unload_event', { clean: true });
    });

    // 3. Trigger the new listener we added to NetworkDispatcher
    await page.evaluate(() => {
      console.warn("Simulating document hidden to trigger unload flush");
      Object.defineProperty(document, 'visibilityState', { value: 'hidden', writable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });

    // 4. Assert
    await expect.poll(() => receivedPayload, { timeout: 2000 }).toBeTruthy();
    expect(receivedPayload.payload.name).toBe('unload_event');
  });

  test('auto-tracks pageviews on history navigation', async ({ page }) => {
    // 1. Setup request capture
    const requestPromise = page.waitForRequest(req => 
      req.url().includes('/api/send') && 
      req.postDataJSON().payload.url === '/virtual/page'
    );

    await page.evaluate(async () => {
      const { createAnalytics } = (window as any).Trackkit;
      const analytics = createAnalytics({
        provider: {
          name: 'umami',
          site: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
          host: 'https://analytics.example.com',
        },
        trackLocalhost: true,
        autoTrack: true,
      });
      
      await analytics.waitForReady();
      analytics.grantConsent();

      // 2. Simulate SPA navigation
      history.pushState({}, '', '/virtual/page');
    });

    // 3. Verify request happened automatically without manual .pageview() call
    const request = await requestPromise;
    expect(request).toBeTruthy();
  });

  test('respects consent denial (no network requests)', async ({ page }) => {
    // 1. Listen for ANY sending activity
    const failedRequestPromise = page.waitForRequest(req => req.url().includes('/api/send'), { timeout: 1000 })
      .catch(() => null); // Expected to timeout

    await page.evaluate(async () => {
      const { createAnalytics } = (window as any).Trackkit;
      const analytics = createAnalytics({
        provider: {
          name: 'umami',
          site: '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
          host: 'https://analytics.example.com',
        },
        trackLocalhost: true,
        consent: {
          initialStatus: 'denied', // Start denied
          requireExplicit: true,
        }
      });

      // 2. Trigger events that should be dropped
      await analytics.waitForReady();
      analytics.track('forbidden_event');
      analytics.pageview();
    });

    // 3. Assert NO request was made
    const result = await failedRequestPromise;
    expect(result).toBeNull();
  });
});