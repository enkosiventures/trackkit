// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConsentManager } from '../../../src/consent/ConsentManager';

describe('ConsentManager', () => {
  beforeEach(() => {
    // Clear localStorage
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('defaults to pending state with explicit consent required', () => {
      const mgr = new ConsentManager();
      expect(mgr.getStatus()).toBe('pending');
      expect(mgr.isAllowed()).toBe(false);
    });

    it('loads persisted state from localStorage', () => {
      const stored = {
        status: 'granted' as const,
        timestamp: Date.now() - 1000,
        version: '1.0',
        method: 'explicit' as const,
      };
      window.localStorage.setItem('__trackkit_consent__', JSON.stringify(stored));

      const mgr = new ConsentManager();
      expect(mgr.getStatus()).toBe('granted');
    });

    it('resets to pending if policy version changes', () => {
      const stored = {
        status: 'granted' as const,
        timestamp: Date.now() - 1000,
        version: '1.0',
        method: 'explicit' as const,
      };
      window.localStorage.setItem('__trackkit_consent__', JSON.stringify(stored));

      const mgr = new ConsentManager({ policyVersion: '2.0' });
      expect(mgr.getStatus()).toBe('pending');
    });

    it('handles corrupt localStorage gracefully', () => {
      window.localStorage.setItem('__trackkit_consent__', 'invalid-json');
      
      const mgr = new ConsentManager();
      expect(mgr.getStatus()).toBe('pending');
    });

    it('respects custom storage key', () => {
      const mgr = new ConsentManager({ storageKey: 'custom_consent' });
      mgr.grant();

      expect(window.localStorage.getItem('custom_consent')).toBeTruthy();
      expect(window.localStorage.getItem('__trackkit_consent__')).toBeNull();
    });

    it('respects disablePersistence option', () => {
      const mgr = new ConsentManager({ disablePersistence: true });
      mgr.grant();

      expect(window.localStorage.getItem('__trackkit_consent__')).toBeNull();
    });
  });

  describe('consent operations', () => {
    it('grants consent explicitly', () => {
      const mgr = new ConsentManager();
      const listener = vi.fn();
      mgr.onChange(listener);

      mgr.grant();

      expect(mgr.getStatus()).toBe('granted');
      expect(mgr.isAllowed()).toBe(true);
      expect(listener).toHaveBeenCalledWith('granted', 'pending');

      // Check persistence
      const stored = JSON.parse(window.localStorage.getItem('__trackkit_consent__')!);
      expect(stored.status).toBe('granted');
      expect(stored.method).toBe('explicit');
    });

    it('denies consent explicitly', () => {
      const mgr = new ConsentManager();
      mgr.deny();

      expect(mgr.getStatus()).toBe('denied');
      expect(mgr.isAllowed()).toBe(false);
    });

    it('resets to pending state', () => {
      const mgr = new ConsentManager();
      mgr.grant();
      expect(mgr.getStatus()).toBe('granted');

      mgr.reset();
      expect(mgr.getStatus()).toBe('pending');
    });

    it('handles implicit consent promotion', () => {
      const mgr = new ConsentManager({ requireExplicit: false });
      expect(mgr.getStatus()).toBe('pending');

      mgr.promoteImplicitIfAllowed();
      expect(mgr.getStatus()).toBe('granted');

      const stored = JSON.parse(window.localStorage.getItem('__trackkit_consent__')!);
      expect(stored.method).toBe('implicit');
    });

    it('does not promote implicit consent when explicit required', () => {
      const mgr = new ConsentManager({ requireExplicit: true });
      mgr.promoteImplicitIfAllowed();
      
      expect(mgr.getStatus()).toBe('pending');
    });
  });

  describe('category checking', () => {
    it('allows all categories when granted', () => {
      const mgr = new ConsentManager();
      mgr.grant();

      expect(mgr.isAllowed()).toBe(true);
      expect(mgr.isAllowed('analytics')).toBe(true);
      expect(mgr.isAllowed('marketing')).toBe(true);
    });

    it('blocks all categories when denied', () => {
      const mgr = new ConsentManager();
      mgr.deny();

      expect(mgr.isAllowed()).toBe(false);
      expect(mgr.isAllowed('analytics')).toBe(false);
      expect(mgr.isAllowed('essential')).toBe(false);
    });

    it('allows only essential when pending', () => {
      const mgr = new ConsentManager();

      expect(mgr.isAllowed()).toBe(false);
      expect(mgr.isAllowed('analytics')).toBe(false);
      expect(mgr.isAllowed('essential')).toBe(true);
    });

    it('allows essential when denied if allowEssentialOnDenied=true', () => {
      const mgr = new ConsentManager({ allowEssentialOnDenied: true });
      mgr.deny();

      expect(mgr.getStatus()).toBe('denied');
      expect(mgr.isAllowed('analytics')).toBe(false);
      expect(mgr.isAllowed('essential')).toBe(true); // allowed due to config
    });

    it('denied blocks analytics but allows essential when configured', () => {
      const mgr = new ConsentManager({ allowEssentialOnDenied: true });
      mgr.deny();

      expect(mgr.isAllowed('analytics')).toBe(false);
      expect(mgr.isAllowed('essential')).toBe(true);
    });
  });

  describe('persistence', () => {
    it('does not write to storage on implicit promotion when disablePersistence=true', () => {
      const mgr = new ConsentManager({ requireExplicit: false, disablePersistence: true });
      mgr.promoteImplicitIfAllowed();

      expect(mgr.getStatus()).toBe('granted');
      // Should not write anything because persistence disabled
      expect(window.localStorage.getItem('__trackkit_consent__')).toBeNull();
    });

    it('does not write to storage on implicit promotion when disablePersistence=true', () => {
      const mgr = new ConsentManager({ requireExplicit: false, disablePersistence: true });
      mgr.promoteImplicitIfAllowed();

      expect(mgr.getStatus()).toBe('granted');
      // Should not write anything because persistence disabled
      expect(window.localStorage.getItem('__trackkit_consent__')).toBeNull();
    });

    it('re-prompts (pending) when a policy version is introduced but stored state had no version', () => {
      // Simulate older sessions that stored without a version
      window.localStorage.setItem('__trackkit_consent__', JSON.stringify({
        status: 'granted',
        timestamp: Date.now() - 1000,
        // no version key
        method: 'explicit',
      }));

      const mgr = new ConsentManager({ policyVersion: '1.0' });
      expect(mgr.getStatus()).toBe('pending');
    });

    it('handles localStorage.setItem failures gracefully during grant()', () => {
      const original = window.localStorage.setItem;
      // Force setItem to throw
      window.localStorage.setItem = vi.fn(() => { throw new Error('quota exceeded'); }) as any;

      const mgr = new ConsentManager();
      expect(() => mgr.grant()).not.toThrow();
      expect(mgr.getStatus()).toBe('granted');

      // restore
      window.localStorage.setItem = original;
    });
  });

  describe('listeners', () => {
    it('notifies multiple listeners on state change', () => {
      const mgr = new ConsentManager();
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      mgr.onChange(listener1);
      mgr.onChange(listener2);

      mgr.grant();

      expect(listener1).toHaveBeenCalledWith('granted', 'pending');
      expect(listener2).toHaveBeenCalledWith('granted', 'pending');
    });

    it('allows unsubscribing', () => {
      const mgr = new ConsentManager();
      const listener = vi.fn();

      const unsubscribe = mgr.onChange(listener);
      unsubscribe();

      mgr.grant();
      expect(listener).not.toHaveBeenCalled();
    });

    it('handles listener errors gracefully', () => {
      const mgr = new ConsentManager();
      const errorListener = vi.fn(() => {
        throw new Error('Listener error');
      });
      const goodListener = vi.fn();

      mgr.onChange(errorListener);
      mgr.onChange(goodListener);

      // Should not throw
      expect(() => mgr.grant()).not.toThrow();
      
      // Good listener should still be called
      expect(goodListener).toHaveBeenCalledWith('granted', 'pending');
    });

    it('does not notify on no-op state changes', () => {
      const mgr = new ConsentManager();
      mgr.grant();

      const listener = vi.fn();
      mgr.onChange(listener);

      mgr.grant(); // Already granted
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('snapshot', () => {
    it('provides complete state snapshot', () => {
      const mgr = new ConsentManager({ 
        policyVersion: '2.0',
        requireExplicit: false,
      });
      
      mgr.grant();

      const snapshot = mgr.snapshot();
      expect(snapshot).toMatchObject({
        status: 'granted',
        version: '2.0',
        method: 'implicit',
      });
    });
  });
});
