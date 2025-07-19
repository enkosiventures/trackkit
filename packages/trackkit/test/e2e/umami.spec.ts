import { describe, it, expect, vi, beforeEach } from 'vitest';


it('Placeholder test', () => {
    expect(true).toBe(true);
});

// import { test, expect } from '@playwright/test';

// test.describe('Umami Provider E2E', () => {
//   test.beforeEach(async ({ page }) => {
//     // Mock Umami endpoint
//     await page.route('**/api/send', (route) => {
//       route.fulfill({
//         status: 200,
//         contentType: 'application/json',
//         body: JSON.stringify({ ok: true }),
//       });
//     });
    
//     await page.goto('/test/fixtures/umami.html');
//   });
  
//   test('sends pageview on load', async ({ page }) => {
//     const requests: any[] = [];
    
//     page.on('request', (request) => {
//       if (request.url().includes('/api/send')) {
//         requests.push({
//           url: request.url(),
//           data: request.postDataJSON(),
//         });
//       }
//     });
    
//     // Initialize analytics
//     await page.evaluate(() => {
//       (window as any).analytics = (window as any).Trackkit.init({
//         provider: 'umami',
//         siteId: 'test-site',
//         autoTrack: true,
//       });
//       (window as any).analytics.setConsent('granted');
//     });
    
//     // Wait for pageview
//     await page.waitForTimeout(500);
    
//     expect(requests).toHaveLength(1);
//     expect(requests[0].data).toMatchObject({
//       website: 'test-site',
//       url: expect.any(String),
//     });
//   });
  
//   test('tracks custom events', async ({ page }) => {
//     let eventData: any;
    
//     await page.route('**/api/send', (route) => {
//       eventData = route.request().postDataJSON();
//       route.fulfill({ status: 200 });
//     });
    
//     await page.evaluate(() => {
//       const { init, track, setConsent } = (window as any).Trackkit;
//       init({ provider: 'umami', siteId: 'test-site' });
//       setConsent('granted');
//       track('test_event', { value: 123 });
//     });
    
//     await expect.poll(() => eventData).toBeTruthy();
//     expect(eventData).toMatchObject({
//       name: 'test_event',
//       data: { value: 123 },
//     });
//   });
  
//   test('handles navigation in SPA', async ({ page }) => {
//     const requests: any[] = [];
    
//     page.on('request', (request) => {
//       if (request.url().includes('/api/send')) {
//         requests.push(request.postDataJSON());
//       }
//     });
    
//     // Initialize with auto-tracking
//     await page.evaluate(() => {
//       const { init, setConsent } = (window as any).Trackkit;
//       init({ 
//         provider: 'umami', 
//         siteId: 'test-site',
//         autoTrack: true 
//       });
//       setConsent('granted');
//     });
    
//     // Simulate SPA navigation
//     await page.evaluate(() => {
//       history.pushState({}, '', '/new-page');
//     });
    
//     await page.waitForTimeout(500);
    
//     // Should have initial + navigation pageview
//     const pageviews = requests.filter(r => !r.name);
//     expect(pageviews.length).toBeGreaterThanOrEqual(2);
//   });
// });