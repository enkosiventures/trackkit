import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init, destroy, grantConsent, denyConsent, resetConsent, getConsent, onConsentChange } from '../../../src';

// @vitest-environment jsdom

describe('Provider API Consistency', () => {
  const consent = { disablePersistence: true };
  const providers: Array<{ name: string; config: any }> = [
    { name: 'noop', config: { provider: 'noop', consent } },
    { name: 'umami', config: { provider: 'umami', siteId: 'test-uuid', consent } },
    { name: 'plausible', config: { provider: 'plausible', siteId: 'test.com', consent } },
    { name: 'ga4', config: { provider: 'ga', siteId: 'G-TEST123456', consent } },
  ];
  
  beforeEach(() => destroy());
  
  providers.forEach(({ name, config }) => {
    describe(`${name} provider`, () => {
      it('implements all required methods', () => {
        const instance = init(config);
        
        // Core tracking methods
        expect(instance).toHaveProperty('track');
        expect(instance).toHaveProperty('pageview');
        expect(instance).toHaveProperty('identify');
        expect(instance).toHaveProperty('destroy');
        
        // Utility methods
        expect(instance).toHaveProperty('waitForReady');
        expect(instance).toHaveProperty('getProvider');
        expect(instance).toHaveProperty('getDiagnostics');
        expect(instance).toHaveProperty('getConsentManager');
        
        // All methods should be functions
        expect(typeof instance.track).toBe('function');
        expect(typeof instance.pageview).toBe('function');
        expect(typeof instance.identify).toBe('function');
        expect(typeof instance.destroy).toBe('function');
      });
      
      it('handles method calls without errors', () => {
        const instance = init(config);
        
        expect(() => {
          instance.track('test_event', { value: 42 });
          instance.pageview('/test-page');
          instance.identify('user-123');
          instance.getDiagnostics();
        }).not.toThrow();
      });
      
      it('respects consent state consistently', () => {
        const instance = init(config);
        
        // Start with pending consent
        expect(getConsent()?.status).toBe('pending');
        
        // Methods should work with consent denied (no-op)
        denyConsent();
        expect(() => {
          instance.track('test');
          instance.pageview();
        }).not.toThrow();
        expect(getConsent()?.status).toBe('denied');
        
        // Methods should work with consent granted
        grantConsent();
        expect(() => {
          instance.track('test');
          instance.pageview();
        }).not.toThrow();
        expect(getConsent()?.status).toBe('granted');
      });
      
      it('provides consistent diagnostics', () => {
        const instance = init(config);
        const diagnostics = instance.getDiagnostics();
        
        expect(diagnostics).toHaveProperty('hasProvider');
        expect(diagnostics).toHaveProperty('providerReady');
        expect(diagnostics).toHaveProperty('totalQueueSize');
        expect(diagnostics).toHaveProperty('consent');
        expect(diagnostics).toHaveProperty('provider');
        expect(diagnostics).toHaveProperty('debug');
        
        expect(diagnostics.provider).toBe(config.provider);
      });
      
      it('handles destroy and reinitialization', () => {
        let instance = init(config);
        
        // Track some events
        instance.track('before_destroy');
        
        // Destroy
        instance.destroy();
        
        // Should be able to reinitialize
        expect(() => {
          instance = init(config);
          instance.track('after_reinit');
        }).not.toThrow();
      });
      
      it('queues events when consent is pending', async () => {
        // Reset consent to pending
        destroy();
        const instance = init(config);
        
        // Track events while consent is pending
        instance.track('queued_event_1');
        instance.track('queued_event_2');
        
        const diagnostics = instance.getDiagnostics();
        expect(diagnostics.ssrQueueSize).toEqual(0);
        expect(diagnostics.totalQueueSize).toBeGreaterThan(0);
        expect(diagnostics.facadeQueueSize).toBeGreaterThan(0);
        
        // Grant consent should flush queue
        grantConsent();
        
        // Give time for queue to flush
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const diagnosticsAfter = instance.getDiagnostics();
        expect(diagnosticsAfter.ssrQueueSize).toEqual(0);
        expect(diagnosticsAfter.totalQueueSize).toEqual(0);
        expect(diagnosticsAfter.facadeQueueSize).toEqual(0);
      });
      
      it('supports consent change callbacks', () => {
        const instance = init(config);
        const callback = vi.fn();
        
        const unsubscribe = onConsentChange(callback);
        
        grantConsent();
        expect(callback).toHaveBeenCalledWith('granted', 'pending');
        
        denyConsent();
        expect(callback).toHaveBeenCalledWith('denied', 'granted');
        
        unsubscribe();
        resetConsent();
        // Should not be called after unsubscribe
        expect(callback).toHaveBeenCalledTimes(2);
      });
    });
  });
  
  describe('Provider-specific behavior', () => {
    it('GA4 requires explicit consent by default', () => {
      const instance = init({ provider: 'ga', siteId: 'G-TEST123456' });
      
      // Should be pending initially
      expect(getConsent()?.status).toBe('pending');
      
      // Events should be queued
      instance.track('test');
      expect(instance.getDiagnostics().facadeQueueSize).toBeGreaterThan(0);
      expect(instance.getDiagnostics().totalQueueSize).toBeGreaterThan(0);
    });
    
    it('Plausible defaults to implicit consent', () => {
      const instance = init({ 
        provider: 'plausible', 
        siteId: 'test.com',
        consent: { requireExplicit: false },
      });
      
      // First interaction should grant consent
      instance.track('test');
      
      // Small delay for implicit consent
      setTimeout(() => {
        expect(getConsent()?.status).toBe('granted');
      }, 100);
    });
  });
});