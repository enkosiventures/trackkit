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
    const events: any[] = [];
    
    server.use(
      http.post('*/api/send', async ({ request }) => {
        const body = await request.json();
        if (body && typeof body === 'object') {
          events.push(body);
        }
        return HttpResponse.json({ ok: true });
      })
    );

    init({
      provider: 'umami',
      siteId: 'test-site',
      consent: { requireExplicit: true },
      autoTrack: true,
      host: 'http://localhost',
    });

    await waitForReady();
    
    expect(events).toHaveLength(0);

    grantConsent();
    
    // Wait for pageview to be sent
    await vi.waitFor(() => {
      const pageviews = events.filter(e => !e.name && e.url);
      expect(pageviews).toHaveLength(1);
    });

    const pageview = events.find(e => !e.name && e.url);
    expect(pageview).toMatchObject({
      url: '/test-page?param=value',
      website: 'test-site',
    });
  });

  it('does not send duplicate initial pageviews', async () => {
    const events: any[] = [];

    server.use(
      http.post('*/api/send', async ({ request }) => {
        const body = await request.json();
        console.log('[DEBUG] Received event:', body);
        
        if (body && typeof body === 'object') {
          events.push(body);
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

    // Trigger implicit consent
    track('some_event');

    // Wait for events to be sent
    await vi.waitFor(() => {
      expect(events.length).toBeGreaterThanOrEqual(2);
    });

    // Filter pageviews (events without 'name' field)
    const pageviews = events.filter(e => !e.name && e.url);
    const trackEvents = events.filter(e => e.name);

    // Should have 1 initial pageview and 1 track event
    expect(pageviews).toHaveLength(1);
    expect(trackEvents).toHaveLength(1);
    expect(trackEvents[0].name).toBe('some_event');

    // Manual pageview
    pageview();
    
    await vi.waitFor(() => {
      const allPageviews = events.filter(e => !e.name && e.url);
      expect(allPageviews).toHaveLength(2);
    });
  });
});