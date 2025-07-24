import { describe, it, expect, beforeEach } from 'vitest';
import { init, destroy, grantConsent, denyConsent } from '../../../src';

describe('Provider API Consistency', () => {
  const providers: Array<{ name: string; config: any }> = [
    { name: 'noop', config: { provider: 'noop' } },
    { name: 'umami', config: { provider: 'umami', siteId: 'test' } },
    { name: 'plausible', config: { provider: 'plausible', siteId: 'test.com' } },
    { name: 'ga4', config: { provider: 'ga', siteId: 'G-TEST123456' } },
  ];
  
  beforeEach(() => destroy());
  
  providers.forEach(({ name, config }) => {
    describe(`${name} provider`, () => {
      it('implements all required methods', () => {
        const instance = init(config);
        
        expect(instance).toHaveProperty('track');
        expect(instance).toHaveProperty('pageview');
        expect(instance).toHaveProperty('identify');
        expect(instance).toHaveProperty('setConsent');
        expect(instance).toHaveProperty('destroy');
        
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
          instance.destroy();
        }).not.toThrow();
      });
      
      it('respects consent state consistently', () => {
        const instance = init(config);
        
        // Methods should work with consent denied (no-op)
        denyConsent();
        expect(() => {
          instance.track('test');
          instance.pageview();
        }).not.toThrow();
        
        // Methods should work with consent granted
        grantConsent();
        expect(() => {
          instance.track('test');
          instance.pageview();
        }).not.toThrow();
      });
    });
  });
});