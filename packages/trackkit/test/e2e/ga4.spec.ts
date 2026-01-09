import { test, expect } from '@playwright/test';

test.describe('GA4 Provider E2E', () => {
  test.beforeEach(async ({ page }) => {
    page.on('console', msg => console.log(`[Browser]: ${msg.text()}`));

    // Standard mock setup
    await page.route('**/mp/collect**', async (route) => {
      await route.fulfill({
        status: 204,
        headers: { 'Access-Control-Allow-Origin': '*' },
      });
    });
    
    // Using the same fixture is fine as long as we clean up window.Trackkit
    await page.goto('/test/fixtures/umami.html'); 
    await page.waitForFunction(() => typeof (window as any).Trackkit !== 'undefined');
  });

  test('sends events with correct GA4 payload structure', async ({ page }) => {
    const requestPromise = page.waitForRequest(req => req.url().includes('/mp/collect'));

    await page.evaluate(async () => {
      const { createAnalytics } = (window as any).Trackkit;
      const analytics = createAnalytics({
        provider: {
          name: 'ga4',
          measurementId: 'G-XXXXXXXXXX',
          apiSecret: 'secret',
        },
        trackLocalhost: true,
        autoTrack: false,
        debug: true,
      });
      
      await analytics.waitForReady();
      analytics.grantConsent();
      analytics.track('purchase', { value: 99.99, currency: 'USD' });
    });

    const request = await requestPromise;
    const url = new URL(request.url());
    const body = request.postDataJSON();

    // 1. Check URL Params (GA4 specific)
    expect(url.searchParams.get('measurement_id')).toBe('G-XXXXXXXXXX');
    expect(url.searchParams.get('api_secret')).toBe('secret');

    // 2. Check Body Structure
    expect(body.events).toHaveLength(1);
    expect(body.events[0].name).toBe('purchase');
    expect(body.events[0].params.value).toBe(99.99);
    
    // 3. Verify Client ID generation (should be auto-generated)
    expect(body.client_id).toBeTruthy();
  });
});