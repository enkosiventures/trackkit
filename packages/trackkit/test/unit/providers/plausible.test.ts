// /// <reference types="vitest" />
// import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// import plausibleProvider from '../../../src/providers/plausible';
// import type { AnalyticsOptions } from '../../../src/types';

// // @vitest-environment jsdom

// // Mock shared modules
// vi.mock('../../../src/providers/shared/browser', async () => {
//   const actual = await vi.importActual('../../../src/providers/shared/browser');
//   return {
//     ...actual,
//     isLocalhost: vi.fn(() => false),
//     isUrlExcluded: vi.fn(() => false),
//     getPageUrl: vi.fn((hashMode) => hashMode ? 'https://example.com/#/route' : 'https://example.com/route'),
//   };
// });

// describe('Plausible Provider', () => {
//   let fetchSpy: any;
  
//   beforeEach(() => {
//     fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
//       new Response('ok', { status: 202 })
//     );
//   });
  
//   afterEach(() => {
//     fetchSpy.mockRestore();
//     vi.clearAllMocks();
//   });
  
//   describe('initialization', () => {
//     it('requires domain configuration', () => {
//       expect(() => {
//         plausibleProvider.create({});
//       }).toThrow('Plausible requires a domain');
      
//       expect(() => {
//         plausibleProvider.create({ siteId: 'example.com' });
//       }).not.toThrow();
//     });
    
//     it('validates domain format', () => {
//       const invalidDomains = [
//         'not a domain',
//         'http://',
//         '...',
//         'domain..com',
//       ];
      
//       invalidDomains.forEach(siteId => {
//         expect(() => {
//           plausibleProvider.create({ siteId });
//         }).toThrow('Invalid domain format');
//       });
//     });
    
//     it('parses domain from various formats', () => {
//       const domains = [
//         ['example.com', 'example.com'],
//         ['https://example.com', 'example.com'],
//         ['https://example.com/', 'example.com'],
//         ['EXAMPLE.COM', 'example.com'],
//         ['subdomain.example.com', 'subdomain.example.com'],
//       ];
      
//       domains.forEach(([input, expected]) => {
//         const instance = plausibleProvider.create({ siteId: input });
//         instance.track('test');
        
//         const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//         expect(body.d).toBe(expected);
        
//         fetchSpy.mockClear();
//       });
//     });
    
//     it('has correct metadata', () => {
//       expect(plausibleProvider.meta).toEqual({
//         name: 'plausible',
//         version: '2.0.0',
//       });
//     });
//   });
  
//   describe('tracking', () => {
//     it('sends events to Plausible API', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//       });
      
//       instance.track('Signup', { plan: 'pro' });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy).toHaveBeenCalledWith(
//         'https://plausible.io/api/event',
//         expect.objectContaining({
//           method: 'POST',
//           headers: expect.objectContaining({
//             'Content-Type': 'application/json',
//             'X-Forwarded-For': '127.0.0.1',
//           }),
//           keepalive: true,
//         })
//       );
      
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body).toMatchObject({
//         n: 'Signup',
//         d: 'example.com',
//         m: { plan: 'pro' },
//         w: expect.any(Number),
//       });
//     });
    
//     it('uses custom host when provided', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         host: 'https://analytics.example.com',
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy.mock.calls[0][0]).toBe('https://analytics.example.com/api/event');
//     });
    
//     it('converts all props to strings', async () => {
//       const instance = plausibleProvider.create({ siteId: 'example.com' });
      
//       instance.track('test', {
//         string: 'value',
//         number: 123,
//         boolean: true,
//         null: null,
//         undefined: undefined,
//         object: { nested: 'value' }, // Should be filtered out
//       });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.m).toEqual({
//         string: 'value',
//         number: '123',
//         boolean: 'true',
//       });
//     });
    
//     it('merges with default props', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         defaultProps: {
//           author: 'john',
//           section: 'blog',
//         },
//       });
      
//       instance.track('Read Article', { 
//         title: 'Test Article',
//         section: 'news', // Should override default
//       });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.m).toEqual({
//         author: 'john',
//         section: 'news',
//         title: 'Test Article',
//       });
//     });
    
//     it('tracks revenue goals when enabled', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         revenue: {
//           currency: 'EUR',
//           trackingEnabled: true,
//         },
//       });
      
//       instance.track('Purchase', { 
//         revenue: 29.99,
//         currency: 'USD',
//         product: 'Premium Plan',
//       });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.$).toBe(2999); // Cents
//       expect(body.$$).toBe('USD');
//       expect(body.m).toEqual({
//         product: 'Premium Plan',
//       });
//     });
    
//     it('does not track revenue when disabled', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         revenue: {
//           currency: 'USD',
//           trackingEnabled: false,
//         },
//       });
      
//       instance.track('Purchase', { revenue: 29.99 });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.$).toBeUndefined();
//       expect(body.$$).toBeUndefined();
//     });
//   });
  
//   describe('localhost handling', () => {
//     it('excludes localhost by default', async () => {
//       const { isLocalhost } = await import('../../../src/providers/shared/browser');
//       (isLocalhost as any).mockReturnValue(true);
      
//       const instance = plausibleProvider.create({ siteId: 'example.com' });
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy).not.toHaveBeenCalled();
      
//       // Reset mock
//       (isLocalhost as any).mockReturnValue(false);
//     });
    
//     it('can track localhost when enabled', async () => {
//       const { isLocalhost } = await import('../../../src/providers/shared/browser');
//       (isLocalhost as any).mockReturnValue(true);
      
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         trackLocalhost: true,
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy).toHaveBeenCalled();
      
//       // Reset mock
//       (isLocalhost as any).mockReturnValue(false);
//     });
//   });
  
//   describe('pageview tracking', () => {
//     it('sends pageview events', async () => {
//       const instance = plausibleProvider.create({ siteId: 'example.com' });
      
//       instance.pageview('/page');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body).toMatchObject({
//         n: 'pageview',
//         d: 'example.com',
//         u: '/page',
//       });
//     });
    
//     it('includes hash when hashMode enabled', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         hashMode: true,
//       });
      
//       instance.pageview();
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.h).toBe(1);
//       expect(body.u).toContain('#/route');
//     });
    
//     it('deduplicates repeated pageviews', async () => {
//       const instance = plausibleProvider.create({ siteId: 'example.com' });
      
//       instance.pageview('/page');
//       instance.pageview('/page'); // Duplicate
//       instance.pageview('/other');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy).toHaveBeenCalledTimes(2);
//     });
//   });
  
//   describe('exclusions', () => {
//     it('excludes configured paths', async () => {
//       const { isUrlExcluded } = await import('../../../src/providers/shared/browser');
//       (isUrlExcluded as any).mockImplementation((url, patterns) => {
//         return patterns?.some(p => url.startsWith(p.replace('*', ''))) || false;
//       });
      
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         exclude: ['/admin/*', '/api/*'],
//       });
      
//       instance.pageview('/admin/dashboard');
//       instance.pageview('/api/users');
//       instance.pageview('/public/page');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       // Only the /public/page should be tracked
//       expect(fetchSpy).toHaveBeenCalledTimes(1);
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.u).toBe('/public/page');
      
//       // Reset mock
//       (isUrlExcluded as any).mockReturnValue(false);
//     });
//   });
  
//   describe('auto-tracking', () => {
//     it('tracks outbound links', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         autoTrack: true,
//       });
      
//       await instance._init?.();
      
//       // Create and click an outbound link
//       const link = document.createElement('a');
//       link.href = 'https://external.com';
//       document.body.appendChild(link);
      
//       const clickEvent = new MouseEvent('click', { bubbles: true });
//       link.dispatchEvent(clickEvent);
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy).toHaveBeenCalled();
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.n).toBe('Outbound Link: Click');
//       expect(body.m?.url).toBe('https://external.com');
      
//       document.body.removeChild(link);
//     });
    
//     it('tracks file downloads', async () => {
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         autoTrack: true,
//       });
      
//       await instance._init?.();
      
//       // Create and click a download link
//       const link = document.createElement('a');
//       link.href = '/files/document.pdf';
//       document.body.appendChild(link);
      
//       const clickEvent = new MouseEvent('click', { bubbles: true });
//       link.dispatchEvent(clickEvent);
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy).toHaveBeenCalled();
//       const body = JSON.parse(fetchSpy.mock.calls[0][1].body);
//       expect(body.n).toBe('File Download');
//       expect(body.m?.file).toBe('document.pdf');
      
//       document.body.removeChild(link);
//     });
//   });
  
//   describe('error handling', () => {
//     it('calls onError callback on failure', async () => {
//       const onError = vi.fn();
//       fetchSpy.mockRejectedValue(new Error('Network error'));
      
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         onError,
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(onError).toHaveBeenCalledWith(
//         expect.objectContaining({
//           code: 'NETWORK_ERROR',
//           provider: 'plausible',
//         })
//       );
//     });
    
//     it('handles non-200 responses', async () => {
//       const onError = vi.fn();
//       fetchSpy.mockResolvedValue(
//         new Response('Bad Request', { status: 400 })
//       );
      
//       const instance = plausibleProvider.create({ 
//         siteId: 'example.com',
//         onError,
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(onError).toHaveBeenCalledWith(
//         expect.objectContaining({
//           code: 'NETWORK_ERROR',
//           message: expect.stringContaining('400'),
//         })
//       );
//     });
//   });
// });


// packages/trackkit/test/providers/plausible.test.ts
import { describe, it, expect, vi } from 'vitest';
import { PlausibleClient } from '../../../src/providers/plausible/client';
import { grantConsent, PageContext, track, waitForReady } from '../../../src';
import plausibleProvider from '../../../src/providers/plausible';


describe('Plausible provider: pageview mapping', () => {
  it('maps ctx fields to payload and avoids window reads', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 202 })
    );
    
    const client = new PlausibleClient({
      domain: 'example.com',
      hashMode: false,
      trackLocalhost: true,
    });

    const ctx: PageContext = {
      url: '/a?x=1#h',
      referrer: '/prev',
      viewportSize: { width: 1234, height: 5678 },
      screenSize: { width: 1920, height: 1080 },
      title: 'Title A',
      language: 'en',
      timestamp: 1111,
    };

    await client.sendPageview('/a?x=1#h', ctx);
    
    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    const payload = JSON.parse(options?.body as string);

    expect(payload).toMatchObject({
      name: 'pageview',
      domain: 'example.com',
      url: '/a?x=1#h',
      referrer: '/prev',
    });
    
    fetchSpy.mockRestore();
  });


  it('does not send when running on localhost (when policy enabled)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const instance = plausibleProvider.create({ siteId: 'example.com' });
    

    instance.pageview('/local-test');
    await new Promise(r => setTimeout(r, 50));

    expect(fetchSpy).not.toHaveBeenCalled();

    fetchSpy.mockRestore();
  });

  it('sends goal events with props (if exposed via trackGoal)', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const instance = plausibleProvider.create({ siteId: 'example.com', trackLocalhost: true });

    // If your client exposes trackGoal(goalName, { props }), use that; otherwise, call track('Goal Name', props)
    (instance as any).trackGoal?.('Signup Complete', { props: { plan: 'pro' } }) ?? instance.track('Signup Complete', { plan: 'pro' });
    await new Promise(r => setTimeout(r, 50));

    const content = fetchSpy.mock.calls[0][1]?.body
    const body = JSON.parse((content || '{}') as string);
    expect(body.name).toBe('Signup Complete');
    expect(body.props).toEqual({ plan: 'pro' });

    fetchSpy.mockRestore();
  });

  it('destroy() is idempotent', () => {
    const instance = plausibleProvider.create({ siteId: 'example.com' });
    expect(() => instance.destroy()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
  });

});

