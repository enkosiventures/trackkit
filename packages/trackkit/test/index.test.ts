import { describe, it, expect, beforeEach, vi } from 'vitest';
import { 
  init, 
  getInstance, 
  track, 
  pageview, 
  identify, 
  setConsent, 
  destroy, 
  waitForReady,
  getDiagnostics,
} from '../src';

describe('Trackkit Core API', () => {
  // let consoleInfo: any;
  
  beforeEach(() => {
    destroy(); // Clean slate for each test
  });

  // beforeEach(() => {
  //   consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => undefined);
  //   destroy();
  // });
  
  // afterEach(() => {
  //   destroy();
  //   consoleInfo.mockRestore();
  // });
  
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
      init({
        provider: 'noop',
        siteId: 'test-site',
        debug: true,
      });
      await waitForReady();

      const diagnostics = getDiagnostics();
      console.warn('Diagnostics:', diagnostics);


      expect(consoleSpy).toHaveBeenCalledWith(
        '%c[trackkit]',
        expect.any(String),
        'Initializing analytics',
        expect.objectContaining({
          provider: 'noop',
        })
      );
      
      // expect(consoleSpy).toHaveBeenCalledWith(
      //   '%c[trackkit]',
      //   expect.any(String),
      //   'Analytics initialized successfully'
      // );

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
      init();
      expect(getInstance()).toBeDefined();
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
      init({ debug: true });
      const analytics = await waitForReady();
      const trackSpy = vi.spyOn(analytics, 'track');
      const pageviewSpy = vi.spyOn(analytics, 'pageview');
      
      track('test_event', { value: 42 }, "/test");
      pageview('/test-page');

      expect(trackSpy).toHaveBeenCalledWith('test_event', { value: 42 }, "/test");
      expect(pageviewSpy).toHaveBeenCalledWith('/test-page');
    });
  });
  
  describe('destroy()', () => {
    it('cleans up the instance', async () => {
      init();
      const analytics = await waitForReady();
      const destroySpy = vi.spyOn(analytics, 'destroy');

      destroy();

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