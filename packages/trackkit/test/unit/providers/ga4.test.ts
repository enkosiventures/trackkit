import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import ga4Provider from '../../../src/providers/ga4';
import { grantConsent } from '../../../src';

describe('GA4 Provider', () => {
  let fetchSpy: any;
  let beaconSpy: any;
  
  beforeEach(() => {
    fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(
      new Response('{}', { status: 200 })
    );
    
    beaconSpy = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true);
  });
  
  afterEach(() => {
    fetchSpy.mockRestore();
    beaconSpy.mockRestore();
    delete (window as any).gtag;
    delete (window as any).dataLayer;
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
    
    it('creates gtag and dataLayer', () => {
      const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
      expect((window as any).gtag).toBeDefined();
      expect((window as any).dataLayer).toBeDefined();
    });
    
    it('sets default consent state to denied', () => {
      ga4Provider.create({ siteId: 'G-TEST123456' });
      
      const dataLayer = (window as any).dataLayer;
      const consentCall = dataLayer.find((call: any) => 
        call[0] === 'consent' && call[1] === 'default'
      );
      
      expect(consentCall).toBeDefined();
      expect(consentCall[2]).toMatchObject({
        analytics_storage: 'denied',
      });
    });
  });
  
  describe('tracking', () => {
    it('sends events via Measurement Protocol', async () => {
      const instance = ga4Provider.create({ 
        siteId: 'G-TEST123456',
        apiSecret: 'test-secret',
      });
      
      grantConsent();
      instance.track('test_event', { value: 42 });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(beaconSpy).toHaveBeenCalled();
      const [url, data] = beaconSpy.mock.calls[0];
      
      expect(url).toContain('google-analytics.com/mp/collect');
      expect(url).toContain('measurement_id=G-TEST123456');
      
      const payload = JSON.parse(new TextDecoder().decode(data));
      expect(payload.events[0]).toMatchObject({
        name: 'test_event',
        params: expect.objectContaining({
          value: 42,
        }),
      });
    });
    
    it('maps standard event names', () => {
      const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      grantConsent();
      
      instance.track('add_to_cart', { item_id: 'SKU-123' });
      
      const payload = JSON.parse(
        new TextDecoder().decode(beaconSpy.mock.calls[0][1])
      );
      
      expect(payload.events[0].name).toBe('add_to_cart');
    });
    
    it('respects consent state', () => {
      const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      
      // Should not track without consent
      instance.track('no_consent');
      expect(beaconSpy).not.toHaveBeenCalled();
      
      // Should track after consent
      grantConsent();
      instance.track('with_consent');
      expect(beaconSpy).toHaveBeenCalled();
    });
    
    it('fallback to fetch when beacon fails', async () => {
      beaconSpy.mockReturnValue(false);
      
      const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      grantConsent();
      instance.track('test');
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(fetchSpy).toHaveBeenCalled();
    });
  });
  
  describe('user identification', () => {
    it('sets user ID for tracking', () => {
      const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      grantConsent();
      
      instance.identify('user-123');
      instance.track('test');
      
      const payload = JSON.parse(
        new TextDecoder().decode(beaconSpy.mock.calls[0][1])
      );
      
      expect(payload.user_id).toBe('user-123');
    });
  });
  
  describe('consent mode', () => {
    it('updates gtag consent on state change', () => {
      const instance = ga4Provider.create({ siteId: 'G-TEST123456' });
      const dataLayer = (window as any).dataLayer;
      
      grantConsent();
      
      const updateCall = dataLayer.find((call: any) => 
        call[0] === 'consent' && call[1] === 'update'
      );
      
      expect(updateCall[2]).toMatchObject({
        analytics_storage: 'granted',
      });
    });
  });
});