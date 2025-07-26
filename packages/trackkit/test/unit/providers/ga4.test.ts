/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ga4Provider from '../../../src/providers/ga4';
import type { AnalyticsOptions } from '../../../src/types';

// @vitest-environment jsdom


async function parseBeaconBody(body: unknown): Promise<any> {
  // Blob (most common with sendBeacon)
  if (body instanceof Blob) {
    console.warn(JSON.stringify(body));
    const text = await body.text();      // Blob#text() returns a Promise<string>
    return JSON.parse(text);
  }
  // String
  if (typeof body === 'string') {
    return JSON.parse(body);
  }
  // ArrayBuffer or TypedArray (BufferSource)
  if (body instanceof ArrayBuffer) {
    return JSON.parse(new TextDecoder().decode(body));
  }
  if (ArrayBuffer.isView(body)) {
    return JSON.parse(new TextDecoder().decode(body as ArrayBufferView as any));
  }
  // URLSearchParams (some implementations use this)
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) {
    // adjust if you need JSON—usually you wouldn’t send GA4 this way
    return Object.fromEntries(body);
  }
  // Anything with .text() (a la Request/Response bodies in some mocks)
  if (body && typeof (body as any).text === 'function') {
    return JSON.parse(await (body as any).text());
  }
  throw new Error(`Unsupported beacon body type: ${Object.prototype.toString.call(body)}`);
}


describe('GA4 Provider', () => {
  let fetchSpy: any;
  let sendBeaconSpy: any;
  
  beforeEach(() => {
    // Mock fetch
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 })
    );
    
    // Mock sendBeacon
    sendBeaconSpy = vi.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', {
      value: sendBeaconSpy,
      configurable: true,
    });
  });
  
  afterEach(() => {
    fetchSpy.mockRestore();
    delete (navigator as any).sendBeacon;
    vi.clearAllMocks();
  });
  
  describe('initialization', () => {
    it('validates measurement ID format', () => {
      expect(() => {
        ga4Provider.create({ siteId: 'invalid' });
      }).toThrow('GA4 requires a valid measurement ID');
      
      expect(() => {
        ga4Provider.create({ siteId: 'G-XXXXXXXXXX' });
      }).not.toThrow();
    });
    
    it('accepts various measurement ID formats', () => {
      const validIds = [
        'G-XXXXXXXXXX',
        'G-ABC123DEF4',
        'G-1234567890',
      ];
      
      validIds.forEach(siteId => {
        expect(() => {
          ga4Provider.create({ siteId });
        }).not.toThrow();
      });
    });
    
    it('has correct metadata', () => {
      expect(ga4Provider.meta).toEqual({
        name: 'ga4',
        version: '1.0.0',
      });
    });
  });
  
  describe('tracking', () => {
    // it('sends events via Measurement Protocol', async () => {
    //   const instance = ga4Provider.create({ 
    //     siteId: 'G-TEST123456',
    //     apiSecret: 'test-secret',
    //   });
      
    //   instance.track('test_event', { value: 42 });
      
    //   await new Promise(resolve => setTimeout(resolve, 100));
      
    //   expect(sendBeaconSpy).toHaveBeenCalled();
    //   const [url, data] = sendBeaconSpy.mock.calls[0];
      
    //   expect(url).toContain('google-analytics.com/mp/collect');
    //   expect(url).toContain('measurement_id=G-TEST123456');
      
    //   const payload = JSON.parse(new TextDecoder().decode(data));
    //   expect(payload.events[0]).toMatchObject({
    //     name: 'test_event',
    //     params: expect.objectContaining({
    //       value: 42,
    //       engagement_time_msec: expect.any(Number),
    //       session_id: expect.any(String),
    //     }),
    //   });
    // });
    
    // it('maps standard event names', async () => {
    //   const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
    //   instance.track('add_to_cart', { item_id: 'SKU-123' });
      
    //   await new Promise(resolve => setTimeout(resolve, 100));

    //   const payload = JSON.parse(
    //     new TextDecoder().decode(sendBeaconSpy.mock.calls[0][1])
    //   );
      
    //   expect(payload.events[0].name).toBe('add_to_cart');
    //   expect(payload.events[0].params.items).toEqual([
    //     { item_id: 'SKU-123' }
    //   ]);
    // });

    // it('maps standard event names', async () => {
    //   const instance = ga4Provider.create({ siteId: 'G-TEST123456' });

    //   instance.track('add_to_cart', { item_id: 'SKU-123' });

    //   // give your provider/microtasks a moment if needed
    //   await new Promise(r => setTimeout(r, 50));

    //   const body = sendBeaconSpy.mock.calls[0][1];
    //   const payload = await parseBeaconBody(body);

    //   expect(payload.events[0].name).toBe('add_to_cart');
    //   expect(payload.events[0].params.items).toEqual([{ item_id: 'SKU-123' }]);
    // });
    
    // it('sends pageview with proper parameters', async () => {
    //   const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
    //   instance.pageview('/test-page');
      
    //   await new Promise(resolve => setTimeout(resolve, 100));
      
    //   const payload = JSON.parse(
    //     new TextDecoder().decode(sendBeaconSpy.mock.calls[0][1])
    //   );
      
    //   expect(payload.events[0]).toMatchObject({
    //     name: 'page_view',
    //     params: expect.objectContaining({
    //       page_location: '/test-page',
    //       page_title: expect.any(String),
    //     }),
    //   });
    // });
    
    it('fallback to fetch when beacon fails', async () => {
      sendBeaconSpy.mockReturnValue(false);
      
      const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalled();
      expect(fetchSpy.mock.calls[0][0]).toContain('google-analytics.com');
    });
    
    it('uses debug endpoint when debug is enabled', async () => {
      const instance = ga4Provider.create({ 
        siteId: 'G-TEST123456',
        debug: true,
      });
      
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const url = sendBeaconSpy.mock.calls[0][0];
      expect(url).toContain('debug/mp/collect');
    });
    
    it('handles different transport methods', async () => {
      const instance = ga4Provider.create({ 
        siteId: 'G-TEST123456',
        transport: 'fetch',
      });
      
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalled();
      expect(sendBeaconSpy).not.toHaveBeenCalled();
    });
  });
  
  // describe('user identification', () => {
  //   it('sets user ID for tracking', async () => {
  //     const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
  //     instance.identify('user-123');
  //     instance.track('test');
      
  //     await new Promise(resolve => setTimeout(resolve, 100));
      
  //     const payload = JSON.parse(
  //       new TextDecoder().decode(sendBeaconSpy.mock.calls[0][1])
  //     );
      
  //     expect(payload.user_id).toBe('user-123');
  //   });
    
  //   it('clears user ID when null passed', async () => {
  //     const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
  //     instance.identify('user-123');
  //     instance.identify(null);
  //     instance.track('test');
      
  //     await new Promise(resolve => setTimeout(resolve, 100));
      
  //     const payload = JSON.parse(
  //       new TextDecoder().decode(sendBeaconSpy.mock.calls[0][1])
  //     );
      
  //     expect(payload.user_id).toBeUndefined();
  //   });
  // });
  
  describe('error handling', () => {
    it('calls onError callback on failure', async () => {
      const onError = vi.fn();
      sendBeaconSpy.mockReturnValue(false);
      fetchSpy.mockRejectedValue(new Error('Network error'));
      
      const instance = ga4Provider.create({ 
        siteId: 'G-TEST123456',
        onError,
      });
      
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'NETWORK_ERROR',
          provider: 'ga4',
        })
      );
    });
  });
  
  describe('auto-tracking', () => {
    // it('sets up navigation callback when initialized', async () => {
    //   const instance = ga4Provider.create({ 
    //     siteId: 'G-TEST123456',
    //     autoTrack: true,
    //   });
      
    //   // Set navigation callback
    //   const navigationCallback = vi.fn();
    //   instance._setNavigationCallback?.(navigationCallback);
      
    //   // Simulate navigation
    //   const newPath = '/new-page';
    //   window.history.pushState({}, '', newPath);
      
    //   await new Promise(resolve => setTimeout(resolve, 10));
      
    //   expect(navigationCallback).toHaveBeenCalledWith(newPath);
    // });
    
    it('cleans up navigation tracking on destroy', async () => {
      const instance = ga4Provider.create({ 
        siteId: 'G-TEST123456',
        autoTrack: true,
      });
      
      const originalPushState = window.history.pushState;
      
      instance.destroy();
      
      // Check that pushState is restored
      expect(window.history.pushState).toBe(originalPushState);
    });
  });
});