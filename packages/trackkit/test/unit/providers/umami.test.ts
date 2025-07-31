// /// <reference types="vitest" />
// import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
// import { server } from '../../setup-msw';
// import { http, HttpResponse } from 'msw';
// import umamiProvider from '../../../src/providers/umami';
// import type { AnalyticsOptions } from '../../../src/types';
// import { TEST_SITE_ID } from '../../setup-umami';

// // @vitest-environment jsdom

// // Enable MSW
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());

// // Mock shared modules
// vi.mock('../../../src/providers/shared/browser', async () => {
//   const actual = await vi.importActual('../../../src/providers/shared/browser');
//   return {
//     ...actual,
//     isDoNotTrackEnabled: vi.fn(() => false),
//     isDomainAllowed: vi.fn(() => true),
//   };
// });

// describe('Umami Provider', () => {
//   const validOptions: AnalyticsOptions = {
//     siteId: TEST_SITE_ID,
//     debug: true,
//   };
  
//   describe('initialization', () => {
//     it('validates website ID - UUID format', () => {
//       expect(() => {
//         umamiProvider.create({ ...validOptions, siteId: undefined });
//       }).toThrow('Umami requires a valid website ID');
      
//       expect(() => {
//         umamiProvider.create({ ...validOptions, siteId: 'invalid' });
//       }).toThrow('Umami requires a valid website ID');
//     });
    
//     it('accepts various UUID formats', () => {
//       const formats = [
//         TEST_SITE_ID,
//         '9e1e6d6e7c0e4b0e8f0a5c5b5b5b5b5b',
//         'data-website-id=9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b',
//       ];
      
//       formats.forEach(siteId => {
//         expect(() => {
//           umamiProvider.create({ ...validOptions, siteId });
//         }).not.toThrow();
//       });
//     });
    
//     it('accepts non-UUID IDs that look valid', () => {
//       const nonUuidIds = [
//         'my-custom-site-id',
//         'site_12345',
//         'ABCDEF123456',
//       ];
      
//       nonUuidIds.forEach(siteId => {
//         expect(() => {
//           umamiProvider.create({ ...validOptions, siteId });
//         }).not.toThrow();
//       });
//     });
    
//     it('returns no-op in non-browser environment', () => {
//       // Mock SSR environment
//       const originalWindow = global.window;
//       delete (global as any).window;
      
//       const instance = umamiProvider.create(validOptions);
//       expect(instance.name).toBe('umami-noop');
//       expect(() => instance.track('test')).not.toThrow();
      
//       // Restore
//       global.window = originalWindow;
//     });
    
//     it('has correct metadata', () => {
//       expect(umamiProvider.meta).toEqual({
//         name: 'umami',
//         version: '2.0.0',
//       });
//     });
//   });
  
//   describe('tracking', () => {
//     it('sends pageview events', async () => {
//       const instance = umamiProvider.create(validOptions);
      
//       let capturedRequest: any;
//       server.use(
//         http.post('https://cloud.umami.is/api/send', async ({ request }) => {
//           capturedRequest = await request.json();
//           return HttpResponse.json({ ok: true });
//         })
//       );
      
//       instance.pageview('/test-page');
      
//       // Wait for async request
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(capturedRequest).toMatchObject({
//         website: TEST_SITE_ID,
//         url: '/test-page',
//         hostname: expect.any(String),
//         language: expect.any(String),
//         screen: expect.stringMatching(/^\d+x\d+$/),
//       });
//     });
    
//     it('sends custom events with data', async () => {
//       const instance = umamiProvider.create(validOptions);
      
//       let capturedRequest: any;
//       server.use(
//         http.post('https://cloud.umami.is/api/send', async ({ request }) => {
//           capturedRequest = await request.json();
//           return HttpResponse.json({ ok: true });
//         })
//       );
      
//       instance.track('button_click', { button_id: 'cta-hero', value: 42 });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(capturedRequest).toMatchObject({
//         website: TEST_SITE_ID,
//         name: 'button_click',
//         data: { button_id: 'cta-hero', value: 42 },
//       });
//     });
    
//     it('uses custom host when provided', async () => {
//       const instance = umamiProvider.create({
//         ...validOptions,
//         host: 'https://analytics.example.com',
//       });
      
//       let capturedUrl: string | undefined;
//       server.use(
//         http.post('*', ({ request }) => {
//           capturedUrl = request.url;
//           return HttpResponse.json({ ok: true });
//         })
//       );
      
//       instance.track('test');
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(capturedUrl).toContain('analytics.example.com');
//     });
    
//     it('handles network errors gracefully', async () => {
//       const onError = vi.fn();
//       const instance = umamiProvider.create({
//         ...validOptions,
//         host: 'https://error.example.com',
//         onError,
//       });
      
//       server.use(
//         http.post('*', () => {
//           return new HttpResponse(null, { status: 500 });
//         })
//       );
      
//       instance.track('test_event');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(onError).toHaveBeenCalledWith(
//         expect.objectContaining({
//           code: 'NETWORK_ERROR',
//           provider: 'umami',
//         })
//       );
//     });
//   });
  
//   describe('Do Not Track', () => {
//     it('respects DNT header when enabled', async () => {
//       const { isDoNotTrackEnabled } = await import('../../../src/providers/shared/browser');
//       (isDoNotTrackEnabled as any).mockReturnValue(true);
      
//       const instance = umamiProvider.create({
//         ...validOptions,
//         doNotTrack: true,
//       });

//       let requestMade = false;
//       server.use(
//         http.post('*', () => {
//           requestMade = true;
//           return new HttpResponse(null, { status: 204 });
//         })
//       );
      
//       instance.track('test');
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(requestMade).toBe(false);
      
//       // Reset mock
//       (isDoNotTrackEnabled as any).mockReturnValue(false);
//     });
    
//     it('ignores DNT when disabled', async () => {
//       const { isDoNotTrackEnabled } = await import('../../../src/providers/shared/browser');
//       (isDoNotTrackEnabled as any).mockReturnValue(true);
      
//       const instance = umamiProvider.create({
//         ...validOptions,
//         doNotTrack: false,
//       });

//       let requestMade = false;
//       server.use(
//         http.post('*', () => {
//           requestMade = true;
//           return new HttpResponse(null, { status: 204 });
//         })
//       );
      
//       instance.track('test');
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(requestMade).toBe(true);
      
//       // Reset mock
//       (isDoNotTrackEnabled as any).mockReturnValue(false);
//     });
//   });
  
//   describe('domain restrictions', () => {
//     it('respects domain whitelist', async () => {
//       const { isDomainAllowed } = await import('../../../src/providers/shared/browser');
//       (isDomainAllowed as any).mockReturnValue(false);
      
//       const instance = umamiProvider.create({
//         ...validOptions,
//         domains: ['allowed.com'],
//       });
      
//       let requestMade = false;
//       server.use(
//         http.post('*', () => {
//           requestMade = true;
//           return new HttpResponse(null, { status: 204 });
//         })
//       );
      
//       instance.track('test');
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(requestMade).toBe(false);
      
//       // Reset mock
//       (isDomainAllowed as any).mockReturnValue(true);
//     });
//   });
  
//   describe('navigation tracking', () => {
//     it('sets up navigation tracking when initialized', async () => {
//       const instance = umamiProvider.create({
//         ...validOptions,
//         autoTrack: true,
//       });
      
//       const navigationCallback = vi.fn();
//       instance._setNavigationCallback?.(navigationCallback);
      
//       await instance._init?.();
      
//       // Simulate navigation
//       window.history.pushState({}, '', '/new-page');
      
//       await new Promise(resolve => setTimeout(resolve, 10));
      
//       expect(navigationCallback).toHaveBeenCalledWith('/new-page');
//     });
    
//     it('cleans up navigation tracking on destroy', async () => {
//       const instance = umamiProvider.create({
//         ...validOptions,
//         autoTrack: true,
//       });
      
//       await instance._init?.();
      
//       const originalPushState = window.history.pushState;
      
//       instance.destroy();
      
//       // Navigation tracking should be cleaned up
//       expect(window.history.pushState).toBe(originalPushState);
//     });
//   });
  
//   describe('cache busting', () => {
//     it('adds cache parameter when enabled', async () => {
//       const instance = umamiProvider.create({
//         ...validOptions,
//         cache: true,
//       });
      
//       let capturedUrl: string | undefined;
//       server.use(
//         http.post('*', ({ request }) => {
//           capturedUrl = request.url;
//           return HttpResponse.json({ ok: true });
//         })
//       );
      
//       instance.track('test');
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(capturedUrl).toMatch(/\?cache=\d+$/);
//     });
    
//     it('does not add cache parameter when disabled', async () => {
//       const instance = umamiProvider.create({
//         ...validOptions,
//         cache: false,
//       });
      
//       let capturedUrl: string | undefined;
//       server.use(
//         http.post('*', ({ request }) => {
//           capturedUrl = request.url;
//           return HttpResponse.json({ ok: true });
//         })
//       );
      
//       instance.track('test');
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(capturedUrl).not.toContain('?cache=');
//     });
//   });
  
//   describe('user identification', () => {
//     it('logs that identification is not supported', () => {
//       const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});
      
//       const instance = umamiProvider.create(validOptions);
//       instance.identify('user-123');
      
//       expect(debugSpy).toHaveBeenCalledWith(
//         expect.stringContaining('does not support user identification'),
//         expect.objectContaining({ userId: 'user-123' })
//       );
      
//       debugSpy.mockRestore();
//     });
//   });
// });


import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';
import { UmamiClient } from '../../../src/providers/umami/client';
import { PageContext } from '../../../src';
import umamiProvider from '../../../src/providers/umami';
import { TEST_SITE_ID } from '../../setup-umami';

import { server } from '../../setup-msw';
import { http, HttpResponse } from 'msw';

// Enable MSW
beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Umami provider: pageview mapping', () => {
  it('uses url/referrer from ctx and does not read window', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 202 })
    );
    const client = new UmamiClient({ websiteId: 'abc' } as any);

    const ctx: PageContext = {
      url: '/a',
      referrer: '/prev',
      viewportSize: { width: 800, height: 600 },
    };
    client.sendPageview('/a', ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    const payload = JSON.parse(options?.body as string);

    expect(payload).toMatchObject({
      payload: {
        website: 'abc',
        url: '/a',
        referrer: '/prev',
        screen: '800x600',
        hostname: 'localhost',
      },
      type: 'pageview',
    });
    
    fetchSpy.mockRestore();
  });

  it('adds cache-busting param when cache=true', async () => {
    let capturedUrl = '';

    server.use(
      http.post('*', ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ ok: true });
      })
    );

    const instance = umamiProvider.create({ siteId: TEST_SITE_ID, cache: true } as any);
    instance.track('test');
    await new Promise(r => setTimeout(r, 60));

    expect(capturedUrl).toContain('?cache=');
  });

  it('destroy() is idempotent', () => {
    const instance = umamiProvider.create({ siteId: TEST_SITE_ID } as any);
    expect(() => instance.destroy()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
  });
});
