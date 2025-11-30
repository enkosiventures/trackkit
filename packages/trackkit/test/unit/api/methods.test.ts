import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  init,
  track,
  pageview,
  identify,
  grantConsent,
  denyConsent,
  resetConsent,
  getConsent,
  getDiagnostics,
  waitForReady,
  flushIfReady,
  destroy,
  hasQueuedEvents,
} from '../../../src';
import { resetTests } from '../../helpers/core';

describe('Public API wrappers', () => {
  beforeEach(() => {
    resetTests();
  });

  afterEach(() => {
    resetTests();
  })

  it('init() + pending consent queues, then grant flushes', async () => {
    init({
      consent: { disablePersistence: true },
      queueSize: 10,
      domains: ['localhost'],
    });

    track('early', { a: 1 });
    pageview();

    let diag = getDiagnostics();
    expect(diag?.queue.totalBuffered).toBe(2);
    expect(hasQueuedEvents()).toBe(true);

    grantConsent();
    await waitForReady();

    diag = getDiagnostics();
    expect(diag?.queue.totalBuffered).toBe(0);
  });

  it('denyConsent() drops new analytics events but allows identify (essential)', async () => {
    init({
      trackLocalhost: true,
      consent: { initialStatus: 'denied', disablePersistence: true, allowEssentialOnDenied: true },
      domains: ['localhost'],
    });

    track('blocked');
    pageview();
    identify('user-1');

    // identify buffered as provider not ready
    expect(getDiagnostics()?.queue.totalBuffered).toBe(1);
    
    await waitForReady();

    // queue remains empty (non-essential dropped), identify executed when provider ready
    const consent = getConsent();
    expect(consent?.status).toBe('denied');
    expect(getDiagnostics()?.queue.totalBuffered).toBe(0);
  });

  it('resetConsent() returns to pending', () => {
    init({
      consent: { initialStatus: 'granted', disablePersistence: true },
      domains: ['localhost'],
    });
    denyConsent();
    let c = getConsent();
    expect(c?.status).toBe('denied');

    resetConsent();
    c = getConsent();
    expect(c?.status).toBe('pending');
  });

  it('waitForReady() resolves once provider is ready', async () => {
    init({
      consent: { initialStatus: 'granted', disablePersistence: true },
      domains: ['localhost'],
    });
    await waitForReady();
  });

  it('identify() + destroy() do not throw via wrappers', async () => {
    init({
      consent: { initialStatus: 'granted', disablePersistence: true },
      domains: ['localhost'],
    });
    identify('abc');
    await flushIfReady();
    expect(() => destroy()).not.toThrow();
  });
});
