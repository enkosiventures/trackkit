/// <reference types="vitest" />
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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
  waitForReady,
  getDiagnostics,
  flushIfReady,
  hasQueuedEvents,
} from '../../src';
import { getFacade } from '../../src/facade/singleton';
import { createStatefulMock } from '../helpers/providers';

// @vitest-environment jsdom

describe('Consent Flow Integration', () => {
  beforeEach(() => {
    try { window.localStorage.clear(); } catch {/* no-op */}
    try { window.sessionStorage.clear(); } catch {/* no-op */}
    destroy();
    vi.clearAllMocks();
  });

  afterEach(() => {
    destroy();
  });

  it('queues events while consent is pending (explicit required)', async () => {
    const facade = init({
      provider: 'noop',
      trackLocalhost: true,
      consent: { requireExplicit: true, disablePersistence: true },
    });

    // Pre-ready calls are fine; we check queue size not network
    track('event1', { value: 1 });
    track('event2', { value: 2 });
    pageview();

    const diagnostics = getDiagnostics();
    expect(diagnostics?.queue.totalBuffered).toBe(3);

    const consent = getConsent();
    expect(consent?.status).toBe('pending');
    expect(facade.getQueueSize()).toBe(3);
  });

  it('flushes the queue after provider ready + consent granted', async () => {
    init({
      provider: 'noop',
      autoTrack: false,
      trackLocalhost: true,
      consent: { requireExplicit: true, disablePersistence: true },
    });

    // Queue some work while pending
    track('purchase', { amount: 99.99 });
    pageview();

    const { stateful, provider } = await createStatefulMock();
    getFacade()?.setProvider(stateful);
    await waitForReady();

    // Still pending => still queued
    expect(hasQueuedEvents()).toBe(true);

    // Grant => flush
    grantConsent();

    // Queue empty and deliveries happened
    const diagnostics = getDiagnostics();
    expect(diagnostics?.queue.totalBuffered).toBe(0);

    const { eventCalls, pageviewCalls } = provider.diagnostics;
    expect(eventCalls.map(e => e.name)).toEqual(['purchase']);
    expect(pageviewCalls.length).toBe(1);
  });

  it('drops new events when consent is denied', async () => {
    init({
      provider: 'noop',
      trackLocalhost: true,
      consent: { requireExplicit: true, disablePersistence: true },
    });
    await waitForReady();

    // Queue while pending
    track('event1');
    track('event2');

    // Deny => clear queue & start dropping
    denyConsent();

    track('event3'); // drop
    track('event4'); // drop

    const consent = getConsent();
    expect(consent?.status).toBe('denied');
    // expect((consent?.droppedEventsDenied ?? 0)).toBeGreaterThan(0);
    expect(hasQueuedEvents()).toBe(false);


    // Queue should be empty (cleared at denial)
    const diagnostics = getDiagnostics();
    expect(diagnostics?.queue.totalBuffered).toBe(0);
  });

  it('handles implicit consent flow (auto-promote on first emittable event)', async () => {
    init({
      provider: 'noop',
      trackLocalhost: true,
      consent: { requireExplicit: false, disablePersistence: true },
    });

    // Starts pending
    expect(getConsent()?.status).toBe('pending');

    // First emittable event should promote to granted (facade calls consent.promoteImplicitIfAllowed)
    track('first_event');

    // allow microtask turn for the facade to update
    await new Promise(r => setTimeout(r, 0));

    const c = getConsent();
    expect(c?.status).toBe('granted');
    expect(c?.method).toBe('implicit');
  });

  it('persists consent across sessions when persistence enabled', async () => {
    // Session 1
    init({
      provider: 'noop',
      trackLocalhost: true,
      consent: { requireExplicit: true, /* persist by default */ },
    });
    grantConsent();
    expect(getConsent()?.status).toBe('granted');

    // End "session"
    destroy();

    // Session 2 in the SAME test (we didn’t clear localStorage)
    init({
      provider: 'noop',
      trackLocalhost: true,
      consent: { requireExplicit: true },
    });

    expect(getConsent()?.status).toBe('granted');
  });

  it('resets consent to pending when policy version changes', () => {
    // Session 1
    init({
      provider: 'noop',
      consent: { requireExplicit: true, policyVersion: '1.0' },
    });
    grantConsent();
    destroy();

    // Session 2 with a new policy version
    init({
      provider: 'noop',
      consent: { requireExplicit: true, policyVersion: '2.0' },
    });

    expect(getConsent()?.status).toBe('pending');
  });

  // it('notifies listeners of consent changes (and unsubscribe works)', () => {
  //   const listener = vi.fn();

  //   init({
  //     provider: 'noop',
  //     consent: { requireExplicit: true, disablePersistence: true },
  //   });

  //   const unsubscribe = onConsentChange(listener);

  //   grantConsent();
  //   expect(listener).toHaveBeenCalledWith('granted', 'pending');

  //   denyConsent();
  //   expect(listener).toHaveBeenCalledWith('denied', 'granted');

  //   unsubscribe();
  //   resetConsent(); // should NOT call listener now
  //   expect(listener).toHaveBeenCalledTimes(2);
  // });

  it('handles consent operations before init gracefully', () => {
    // Ensure no instance
    destroy();

    // Should be no-ops / safe
    expect(() => grantConsent()).not.toThrow();
    expect(() => denyConsent()).not.toThrow();
    expect(() => resetConsent()).not.toThrow();

    // getConsent() returns null before init
    expect(getConsent()).toBeNull();
  });

  it('clears queue on consent denial', async () => {
    init({
      provider: 'noop',
      trackLocalhost: true,
      consent: { requireExplicit: true, disablePersistence: true },
    });

    // Queue a bunch
    window.history.pushState({}, '', '/page1');
    track('event1');
    track('event2');
    track('event3');
    pageview();
    identify('user123');

    expect(getDiagnostics()?.queue.totalBuffered).toBe(5);

    // Deny => flush queue to zero
    denyConsent();
    expect(getDiagnostics()?.queue.totalBuffered).toBe(0);
  });

  it('emits all change notifications on rapid consent state changes', () => {
    const changes: string[] = [];

    const facade = init({
      provider: 'noop',
      consent: { requireExplicit: true, disablePersistence: true },
    });

    const unsub = facade.onConsentChange((status) => {
      changes.push(status);
    });

    grantConsent();
    denyConsent();
    grantConsent();
    resetConsent();
    denyConsent();

    unsub();

    expect(changes).toEqual(['granted', 'denied', 'granted', 'pending', 'denied']);
  });

  it('allows "essential" category even when denied (when configured)', async () => {
    // Denied but allow essential
    init({
      provider: 'noop',
      trackLocalhost: true,
      consent: { requireExplicit: true, disablePersistence: true, allowEssentialOnDenied: true },
    });

    const { stateful, provider } = await createStatefulMock();
    getFacade()?.setProvider(stateful);
    await waitForReady();

    denyConsent();

    // Should be dropped (analytics)
    track('analytics_evt', { x: 1 }, 'analytics');

    // Should be allowed (essential)
    track('heartbeat', { ok: true }, 'essential');

    await flushIfReady();
    await new Promise(r => setTimeout(r, 30));

    expect(provider.diagnostics.eventCalls.map(e => e.name)).toEqual(['heartbeat']);
  });
});
