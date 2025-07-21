// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  init,
  destroy,
  track,
  pageview,
  identify,
  grantConsent,
  denyConsent,
  resetConsent,
  getConsent,
  onConsentChange,
  waitForReady,
  getDiagnostics,
} from '../../src';

describe('Consent Flow Integration', () => {
  beforeEach(() => {
    window.localStorage.clear();
    destroy();
  });

  afterEach(() => {
    destroy();
  });

  it('queues events while consent is pending', async () => {
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    // Track events while pending
    track('event1', { value: 1 });
    track('event2', { value: 2 });
    pageview('/test');

    const diagnostics = getDiagnostics();
    expect(diagnostics.queueSize).toBe(3);

    const consent = getConsent();
    expect(consent?.status).toBe('pending');
    expect(consent?.queuedEvents).toBe(3);
  });

  it('flushes queue when consent is granted', async () => {
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    // Queue events
    track('purchase', { amount: 99.99 });
    pageview('/checkout');

    // Check events are queued
    let diagnostics = getDiagnostics();
    expect(diagnostics.queueSize).toBe(2);

    await waitForReady();

    // Grant consent
    grantConsent();

    // Give it time to flush
    await new Promise(resolve => setTimeout(resolve, 100));

    // Queue should be empty after flush
    diagnostics = getDiagnostics();
    expect(diagnostics.queueSize).toBe(0);
    
    // Consent should show events were queued
    const consent = getConsent();
    expect(consent?.queuedEvents).toBeGreaterThan(0);
  });

  it('drops new events when consent is denied', async () => {
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    // Queue some events
    track('event1');
    track('event2');

    // Deny consent
    denyConsent();

    // Try to track more - should be dropped
    track('event3');
    track('event4');

    const consent = getConsent();
    expect(consent?.status).toBe('denied');
    expect(consent?.droppedEventsDenied).toBeGreaterThan(0);

    // Queue should be empty
    const diagnostics = getDiagnostics();
    expect(diagnostics.queueSize).toBe(0);
  });

  it('handles implicit consent flow', async () => {
    init({
      provider: 'noop',
      consent: { requireExplicit: false },
    });

    expect(getConsent()?.status).toBe('pending');

    // First track should promote to granted
    track('first_event');

    // Small delay for state update
    await new Promise(resolve => setTimeout(resolve, 0));

    expect(getConsent()?.status).toBe('granted');
    expect(getConsent()?.method).toBe('implicit');
  });

  it('persists consent across sessions', () => {
    // Session 1
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    grantConsent();
    expect(getConsent()?.status).toBe('granted');

    destroy();

    // Session 2 - should remember consent
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    expect(getConsent()?.status).toBe('granted');
  });

  it('resets consent on policy version change', () => {
    // Session 1 with v1 policy
    init({
      provider: 'noop',
      consent: {
        requireExplicit: true,
        policyVersion: '1.0',
      },
    });

    grantConsent();
    destroy();

    // Session 2 with v2 policy
    init({
      provider: 'noop',
      consent: {
        requireExplicit: true,
        policyVersion: '2.0',
      },
    });

    expect(getConsent()?.status).toBe('pending');
  });

  it('notifies listeners of consent changes', async () => {
    const listener = vi.fn();

    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    const unsubscribe = onConsentChange(listener);

    grantConsent();
    expect(listener).toHaveBeenCalledWith('granted', 'pending');

    denyConsent();
    expect(listener).toHaveBeenCalledWith('denied', 'granted');

    unsubscribe();
    resetConsent();
    expect(listener).toHaveBeenCalledTimes(2); // Not called for reset
  });

  it('handles consent operations before init gracefully', async () => {
    // Make sure we're in a clean state
    destroy();

    await new Promise(resolve => setTimeout(resolve, 10)); // Let destroy complete
    
    // These should not throw even without init
    expect(() => grantConsent()).not.toThrow();
    expect(() => denyConsent()).not.toThrow();
    expect(() => resetConsent()).not.toThrow();
    
    // Should return null before init
    expect(getConsent()).toBeNull();
    
    const unsubscribe = onConsentChange(() => {});
    expect(typeof unsubscribe).toBe('function');
  });

  it('clears queue on consent denial', async () => {
    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    // Queue multiple events
    track('event1');
    track('event2');
    track('event3');
    pageview('/page1');
    identify('user123');

    expect(getDiagnostics().queueSize).toBe(5);

    // Deny consent - should clear queue
    denyConsent();

    expect(getDiagnostics().queueSize).toBe(0);
  });

  it('handles rapid consent state changes', async () => {
    const changes: string[] = [];

    init({
      provider: 'noop',
      consent: { requireExplicit: true },
    });

    onConsentChange((status) => {
      changes.push(status);
    });

    // Rapid state changes
    grantConsent();
    denyConsent();
    grantConsent();
    resetConsent();
    denyConsent();

    expect(changes).toEqual(['granted', 'denied', 'granted', 'pending', 'denied']);
  });
});