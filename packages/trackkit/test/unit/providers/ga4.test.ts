// /// <reference types="vitest" />
// import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// import ga4Provider from '../../../src/providers/ga4';
// import type { AnalyticsOptions } from '../../../src/types';

// // @vitest-environment jsdom

// describe('GA4 Provider', () => {
//   let fetchSpy: any;
//   let sendBeaconSpy: any;
  
//   beforeEach(() => {
//     // Mock fetch
//     fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
//       new Response('{}', { status: 200 })
//     );
    
//     // Mock sendBeacon
//     sendBeaconSpy = vi.fn().mockReturnValue(true);
//     Object.defineProperty(navigator, 'sendBeacon', {
//       value: sendBeaconSpy,
//       configurable: true,
//     });
    
//     // Mock localStorage
//     const localStorageMock = {
//       getItem: vi.fn(),
//       setItem: vi.fn(),
//       removeItem: vi.fn(),
//       clear: vi.fn(),
//     };
//     Object.defineProperty(window, 'localStorage', {
//       value: localStorageMock,
//       configurable: true,
//     });
    
//     // Mock sessionStorage
//     const sessionStorageMock = {
//       getItem: vi.fn(),
//       setItem: vi.fn(),
//       removeItem: vi.fn(),
//       clear: vi.fn(),
//     };
//     Object.defineProperty(window, 'sessionStorage', {
//       value: sessionStorageMock,
//       configurable: true,
//     });
//   });
  
//   afterEach(() => {
//     fetchSpy.mockRestore();
//     delete (navigator as any).sendBeacon;
//     vi.clearAllMocks();
//   });
  
//   describe('initialization', () => {
//     it('validates measurement ID format', () => {
//       const invalidIds = [
//         '',
//         'invalid',
//         'UA-123456-1', // Old Universal Analytics format
//         'G-ABC', // Too short
//         'G-ABCDEFGHIJK', // Too long
//         'g-abcdefghij', // Lowercase
//       ];
      
//       invalidIds.forEach(siteId => {
//         expect(() => {
//           ga4Provider.create({ siteId });
//         }).toThrow('Invalid GA4 Measurement ID');
//       });
      
//       expect(() => {
//         ga4Provider.create({ siteId: 'G-XXXXXXXXXX' });
//       }).not.toThrow();
//     });
    
//     it('accepts various measurement ID formats', () => {
//       const validIds = [
//         'G-XXXXXXXXXX',
//         'G-ABC123DEF4',
//         'G-1234567890',
//       ];
      
//       validIds.forEach(siteId => {
//         expect(() => {
//           ga4Provider.create({ siteId });
//         }).not.toThrow();
//       });
//     });
    
//     it('extracts measurement ID from tag manager format', () => {
//       const instance = ga4Provider.create({ 
//         siteId: 'GTM-XXXXX/G-ABC123DEF4/other-stuff' 
//       });
      
//       instance.track('test');
      
//       const url = sendBeaconSpy.mock.calls[0][0];
//       expect(url).toContain('measurement_id=G-ABC123DEF4');
//     });
    
//     it('has correct metadata with consent defaults', () => {
//       expect(ga4Provider.meta).toEqual({
//         name: 'ga4',
//         version: '2.0.0',
//       });
//     });
//   });
  
//   describe('tracking', () => {
//     it('sends events via Measurement Protocol', async () => {
//       const instance = ga4Provider.create({ 
//         siteId: 'G-TEST123456',
//         apiSecret: 'test-secret',
//       });
      
//       instance.track('test_event', { value: 42, custom_param: 'test' });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(sendBeaconSpy).toHaveBeenCalled();
//       const [url, blob] = sendBeaconSpy.mock.calls[0];
      
//       expect(url).toContain('google-analytics.com/mp/collect');
//       expect(url).toContain('measurement_id=G-TEST123456');
//       expect(url).toContain('api_secret=test-secret');
      
//       // Parse blob data
//       const payload = JSON.parse(await blob.text());
//       expect(payload).toMatchObject({
//         client_id: expect.stringMatching(/^\d+\.[a-z0-9]+$/),
//         timestamp_micros: expect.any(Number),
//         events: [{
//           name: 'test_event',
//           params: expect.objectContaining({
//             value: 42,
//             custom_param: 'test',
//             engagement_time_msec: 100,
//             session_id: expect.any(String),
//             page_location: expect.any(String),
//             screen_resolution: expect.stringMatching(/^\d+x\d+$/),
//           }),
//         }],
//       });
//     });
    
//     it('maps standard event names', async () => {
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
//       const eventMappings = [
//         ['add_to_cart', 'add_to_cart'],
//         ['purchase', 'purchase'],
//         ['login', 'login'],
//         ['custom_event', 'custom_event'], // Unmapped events pass through
//       ];
      
//       for (const [input, expected] of eventMappings) {
//         instance.track(input);
        
//         const payload = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//         expect(payload.events[0].name).toBe(expected);
        
//         sendBeaconSpy.mockClear();
//       }
//     });
    
//     it('processes ecommerce parameters', async () => {
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
//       instance.track('add_to_cart', {
//         item_id: 'SKU-123',
//         item_name: 'Blue T-Shirt',
//         price: 29.99,
//         quantity: 2,
//       });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const payload = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//       expect(payload.events[0].params.items).toEqual([{
//         item_id: 'SKU-123',
//         item_name: 'Blue T-Shirt',
//         price: 29.99,
//         quantity: 2,
//       }]);
//     });
    
//     it('sends pageview with proper parameters', async () => {
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
//       instance.pageview('/test-page');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const payload = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
      
//       expect(payload.events[0]).toMatchObject({
//         name: 'page_view',
//         params: expect.objectContaining({
//           page_location: '/test-page',
//           page_title: expect.any(String),
//           page_referrer: expect.any(String),
//         }),
//       });
//     });
    
//     it('uses debug endpoint when debug is enabled', async () => {
//       // Mock debug response
//       fetchSpy.mockResolvedValue(
//         new Response(JSON.stringify({
//           validationMessages: []
//         }), { status: 200 })
//       );
      
//       const instance = ga4Provider.create({ 
//         siteId: 'G-TEST123456',
//         debug: true,
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const url = fetchSpy.mock.calls[0][0];
//       expect(url).toContain('debug/mp/collect');
//     });
    
//     it('handles different transport methods', async () => {
//       const instance = ga4Provider.create({ 
//         siteId: 'G-TEST123456',
//         transport: 'fetch',
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(fetchSpy).toHaveBeenCalled();
//       expect(sendBeaconSpy).not.toHaveBeenCalled();
//     });
    
//     it('falls back to fetch when beacon fails', async () => {
//       sendBeaconSpy.mockReturnValue(false);
      
//       const instance = ga4Provider.create({ 
//         siteId: 'G-TEST123456',
//         transport: 'beacon',
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(sendBeaconSpy).toHaveBeenCalled();
//       expect(fetchSpy).toHaveBeenCalled(); // Fallback
//     });
//   });
  
//   describe('user identification', () => {
//     it('sets user ID for tracking', async () => {
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
//       instance.identify('user-123');
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const payload = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//       expect(payload.user_id).toBe('user-123');
//     });
    
//     it('clears user ID when null passed', async () => {
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
//       instance.identify('user-123');
//       instance.identify(null);
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const payload = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//       expect(payload.user_id).toBeUndefined();
//     });
//   });
  
//   describe('session management', () => {
//     it('generates consistent session ID', async () => {
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
//       instance.track('event1');
//       instance.track('event2');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const payload1 = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//       const payload2 = JSON.parse(await sendBeaconSpy.mock.calls[1][1].text());
      
//       expect(payload1.events[0].params.session_id).toBe(
//         payload2.events[0].params.session_id
//       );
//     });
    
//     it('respects session timeout', async () => {
//       vi.useFakeTimers();
      
//       const instance = ga4Provider.create({ 
//         siteId: 'G-TEST123456',
//         sessionTimeout: 1, // 1 minute for testing
//       });
      
//       instance.track('event1');
//       const payload1 = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//       const sessionId1 = payload1.events[0].params.session_id;
      
//       // Advance time past session timeout
//       vi.advanceTimersByTime(2 * 60 * 1000);
      
//       instance.track('event2');
//       const payload2 = JSON.parse(await sendBeaconSpy.mock.calls[1][1].text());
//       const sessionId2 = payload2.events[0].params.session_id;
      
//       expect(sessionId1).not.toBe(sessionId2);
      
//       vi.useRealTimers();
//     });
//   });
  
//   describe('custom dimensions and metrics', () => {
//     it('maps custom dimensions', async () => {
//       const instance = ga4Provider.create({ 
//         siteId: 'G-TEST123456',
//         customDimensions: {
//           plan_type: 'custom_dimension_1',
//           user_role: 'custom_dimension_2',
//         },
//       });
      
//       instance.track('test', {
//         plan_type: 'premium',
//         user_role: 'admin',
//         other_param: 'value',
//       });
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const payload = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//       const params = payload.events[0].params;
      
//       expect(params.custom_dimension_1).toBe('premium');
//       expect(params.custom_dimension_2).toBe('admin');
//       expect(params.other_param).toBe('value');
//       expect(params.plan_type).toBeUndefined();
//       expect(params.user_role).toBeUndefined();
//     });
//   });
  
//   describe('error handling', () => {
//     it('calls onError callback on failure', async () => {
//       const onError = vi.fn();
//       sendBeaconSpy.mockReturnValue(false);
//       fetchSpy.mockRejectedValue(new Error('Network error'));
      
//       const instance = ga4Provider.create({ 
//         siteId: 'G-TEST123456',
//         onError,
//       });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(onError).toHaveBeenCalledWith(
//         expect.objectContaining({
//           code: 'NETWORK_ERROR',
//           provider: 'ga4',
//         })
//       );
//     });
//   });
  
//   describe('client ID persistence', () => {
//     it('generates and persists client ID', async () => {
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       expect(window.localStorage.setItem).toHaveBeenCalledWith(
//         '_trackkit_ga_cid',
//         expect.stringMatching(/^\d+\.[a-z0-9]+$/)
//       );
//     });
    
//     it('reuses existing GA cookie client ID', async () => {
//       // Mock GA cookie
//       Object.defineProperty(document, 'cookie', {
//         value: '_ga=GA1.2.123456789.987654321; other=value',
//         configurable: true,
//       });
      
//       const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
//       instance.track('test');
      
//       await new Promise(resolve => setTimeout(resolve, 100));
      
//       const payload = JSON.parse(await sendBeaconSpy.mock.calls[0][1].text());
//       expect(payload.client_id).toBe('123456789.987654321');
      
//       // Clean up
//       Object.defineProperty(document, 'cookie', {
//         value: '',
//         configurable: true,
//       });
//     });
//   });
// });


// packages/trackkit/test/providers/ga4.test.ts
import { describe, it, expect, vi } from 'vitest';
import { GA4Client } from '../../../src/providers/ga4/client';
import { PageContext } from '../../../src';
import ga4Provider from '../../../src/providers/ga4';

describe('GA4 provider: pageview mapping', () => {
  it('derives gtag/measurement payload from ctx', () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('ok', { status: 202 })
    );
    const client = new GA4Client({ measurementId: 'G-XXXX' } as any);

    const ctx: PageContext = { url: '/a?x=1', referrer: '/prev', title: 'Title' };
    client.sendPageview('/a?x=1', ctx);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, options] = fetchSpy.mock.calls[0];
    const payload = JSON.parse(options?.body as string);

    console.warn('Captured payload:', payload);
    
    expect(payload).toMatchObject({
      client_id: expect.stringMatching(/^\d+\.[a-z0-9]+$/),
      non_personalized_ads: false,
      timestamp_micros: expect.any(Number),
      events: [{
        name: 'page_view',
        params: {
          session_id: expect.any(String),
          engagement_time_msec: 100, // Required by GA4
          page_location: '/a?x=1',
          page_referrer: '/prev',
          page_title: 'Title',
        },
      }],
    });
    
    fetchSpy.mockRestore();
  });

  it('falls back to fetch when navigator.sendBeacon is unavailable', async () => {
    const original = (navigator as any).sendBeacon;
    // Remove sendBeacon
    Object.defineProperty(navigator, 'sendBeacon', { value: undefined, configurable: true });

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}', { status: 200 }));
    const instance = ga4Provider.create({ siteId: 'G-TEST123456' });

    instance.pageview('/a');
    await new Promise(r => setTimeout(r, 60));

    expect(fetchSpy).toHaveBeenCalledTimes(1);

    // cleanup
    fetchSpy.mockRestore();
    Object.defineProperty(navigator, 'sendBeacon', { value: original, configurable: true });
  });

  it('destroy() is idempotent', () => {
    const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
    expect(() => instance.destroy()).not.toThrow();
    expect(() => instance.destroy()).not.toThrow();
  });
});
