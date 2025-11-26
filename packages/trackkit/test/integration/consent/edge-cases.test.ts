// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  init,
  destroy,
  grantConsent,
  getConsent,
} from '../../../src';

describe('Consent Edge Cases', () => {
  beforeEach(() => {
    window.localStorage.clear();
    destroy();
  });

  it('handles localStorage unavailable', () => {
    // Mock localStorage as unavailable
    const originalLocalStorage = window.localStorage;
    Object.defineProperty(window, 'localStorage', {
      value: null,
      configurable: true,
    });

    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    // Should work without persistence
    expect(getConsent()?.status).toBe('pending');
    grantConsent();
    expect(getConsent()?.status).toBe('granted');

    // Restore
    Object.defineProperty(window, 'localStorage', {
      value: originalLocalStorage,
      configurable: true,
    });
  });

  it('handles localStorage quota exceeded', () => {
    // Mock localStorage.setItem to throw
    const mockSetItem = vi.fn(() => {
      throw new Error('QuotaExceededError');
    });
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(mockSetItem);

    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    // Should not throw
    expect(() => grantConsent()).not.toThrow();
    expect(getConsent()?.status).toBe('granted');
  });

  it('handles consent with very long policy version', () => {
    const longVersion = 'v' + '1.0.0-alpha.beta.gamma.'.repeat(100);

    init({
      provider: 'noop',
      consent: {
        requireExplicit: true,
        policyVersion: longVersion,
      },
    });

    grantConsent();
    
    const consent = getConsent();
    expect(consent?.version).toBe(longVersion);
  });

  it('maintains consent state through multiple init calls', () => {
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    grantConsent();

    // Re-init should not reset consent
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    expect(getConsent()?.status).toBe('granted');
  });
});