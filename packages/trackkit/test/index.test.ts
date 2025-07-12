import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  init, 
  getInstance, 
  track, 
  pageview, 
  identify, 
  setConsent, 
  destroy 
} from '../src';

describe('Trackkit Core API', () => {
  beforeEach(() => {
    destroy(); // Clean slate for each test
  });
  
  describe('init()', () => {
    it('creates and returns an analytics instance', async () => {
      const analytics = init();
      expect(analytics).toBeDefined();
      expect(analytics).toHaveProperty('track');
      expect(analytics).toHaveProperty('pageview');
      expect(analytics).toHaveProperty('identify');
      expect(analytics).toHaveProperty('setConsent');
      expect(analytics).toHaveProperty('destroy');
    });
    
    it('accepts configuration options', async () => {
      const consoleSpy = vi.spyOn(console, 'info').mockImplementation(() => undefined);
      
      await init({
        provider: 'noop',
        siteId: 'test-site',
        debug: true,
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '%c[trackkit]',
        expect.any(String),
        'Initializing analytics',
        expect.objectContaining({
          provider: 'noop',
        })
      );
      
      expect(consoleSpy).toHaveBeenCalledWith(
        '%c[trackkit]',
        expect.any(String),
        'Analytics initialized successfully'
      );

      consoleSpy.mockRestore();
    });

    it('uses default options when none provided', async () => {
      const analytics = init();
      expect(analytics).toBeDefined();
    });
  });
  
  describe('getInstance()', () => {
    it('returns null before initialization', () => {
      expect(getInstance()).toBeNull();
    });

    it('returns the instance after initialization', async () => {
      const analytics = init();
      expect(getInstance()).toBe(analytics);
    });
    
    it('returns null after destroy', () => {
      init();
      destroy();
      expect(getInstance()).toBeNull();
    });
  });
  
  describe('Module-level methods', () => {
    it('safely handles calls before initialization', () => {
      expect(() => track('test')).not.toThrow();
      expect(() => pageview()).not.toThrow();
      expect(() => identify('user123')).not.toThrow();
      expect(() => setConsent('granted')).not.toThrow();
    });

    it('delegates to instance methods after initialization', async () => {
      const analytics = await init({ debug: true });
      const trackSpy = vi.spyOn(analytics, 'track');
      const pageviewSpy = vi.spyOn(analytics, 'pageview');
      
      await track('test_event', { value: 42 });
      await pageview('/test-page');

      expect(trackSpy).toHaveBeenCalledWith('test_event', { value: 42 });
      expect(pageviewSpy).toHaveBeenCalledWith('/test-page');
    });
  });
  
  describe('destroy()', () => {
    it('cleans up the instance', async () => {
      const analytics = init();
      const destroySpy = vi.spyOn(analytics, 'destroy');

      await destroy();

      expect(destroySpy).toHaveBeenCalled();
      expect(getInstance()).toBeNull();
    });

    it('is safe to call multiple times', async () => {
      init();
      expect(() => {
        destroy();
        destroy();
        destroy();
      }).not.toThrow();
    });
  });
});