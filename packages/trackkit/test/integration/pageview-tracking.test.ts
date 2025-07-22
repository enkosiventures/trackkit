/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import { init, track, waitForReady, grantConsent, pageview, destroy } from '../../src';
import { server } from '../setup-msw';
import { http, HttpResponse } from 'msw';

// @vitest-environment jsdom

const mockLocation = {
  pathname: '/test-page',
  search: '?param=value',
  hash: '',
  host: 'example.com',
  hostname: 'example.com',
  href: 'https://example.com/test-page?param=value',
  origin: 'https://example.com',
  port: '',
  protocol: 'https:',
};

describe('Pageview Tracking with Consent', () => {

  // Enable MSW
  beforeAll(() => server.listen());
  afterAll(() => server.close());

  beforeEach(() => {
    // Clear any module cache to ensure fresh imports
    vi.resetModules();
    
    // Mock window location
    Object.defineProperty(window, 'location', {
      value: mockLocation,
      configurable: true,
      writable: true,
    });
    
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  afterEach(async () => {
    destroy();
    
    // Wait for any pending async operations
    await new Promise(resolve => setTimeout(resolve, 50));
    
    server.resetHandlers();
    delete (window as any).location;
    vi.clearAllMocks();
  });

  it('sends initial pageview after consent is granted', async () => {
    const pageviews: any[] = [];
    
    server.use(
      http.post('*/api/send', async ({ request }) => {
        const body = await request.json();
        if (body && typeof body === 'object' && 'url' in body) {
          pageviews.push(body);
        }
        return HttpResponse.json({ ok: true });
      })
    );

    init({
      provider: 'umami',
      siteId: 'test-site',
      consent: { requireExplicit: true },
      autoTrack: true,
      host: 'http://localhost', // Use local URL for tests
    });

    await waitForReady();
    
    expect(pageviews).toHaveLength(0);

    grantConsent();
    
    // Wait for network request
    await vi.waitFor(() => {
      expect(pageviews).toHaveLength(1);
    });

    expect(pageviews[0]).toMatchObject({
      url: '/test-page?param=value',
      website: 'test-site',
    });
  });


  it('does not send duplicate initial pageviews', async () => {
    const pageviews: any[] = [];

    server.use(
      http.post('*/api/send', async ({ request }) => {
        const body = await request.json();
        if (body && typeof body === 'object' && 'url' in body) {
          pageviews.push(body);
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    init({
      provider: 'umami',
      siteId: 'test-site',
      consent: { requireExplicit: false },
      autoTrack: true,
      host: 'http://localhost',
    });

    await waitForReady();

    // Trigger implicit consent with first track
    track('some_event');

    // Wait for the implicit consent to trigger and initial pageview to be sent
    await vi.waitFor(() => {
      expect(pageviews).toHaveLength(1);  // Initial pageview
    }, { timeout: 1000 });

    // Now send manual pageview
    pageview();
    
    // Wait for the manual pageview
    await vi.waitFor(() => {
      expect(pageviews).toHaveLength(2);
    }, { timeout: 1000 });
    
    // Verify we have exactly 2 pageviews
    expect(pageviews).toHaveLength(2);
    expect(pageviews[0].url).toBe('/test-page?param=value'); // Initial
    expect(pageviews[1].url).toBe('/test-page?param=value'); // Manual
  });
});