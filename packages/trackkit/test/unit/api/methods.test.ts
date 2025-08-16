import { describe, it, expect, beforeEach } from 'vitest';
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
} from '../../../src/methods';
import { tick } from '../../helpers/core';

describe('Public API wrappers', () => {
  beforeEach(() => {
    // clean up any previous instance
    try { destroy(); } catch {}
  });

  it('init() + pending consent queues, then grant flushes', async () => {
    init({
      provider: 'noop',
      debug: true,
      consent: { initialStatus: 'pending', disablePersistence: true },
      queueSize: 10,
      domains: ['localhost'],
    });

    track('early', { a: 1 });
    pageview();

    let diag = getDiagnostics();
    expect(diag.facadeQueueSize).toBe(2);
    expect(await hasQueuedEvents()).toBe(true);

    grantConsent();

    await tick(10);
    diag = getDiagnostics();
    expect(diag.facadeQueueSize).toBe(0);
  });

  it('denyConsent() drops new analytics events but allows identify (essential)', async () => {
    init({
      provider: 'noop',
      debug: true,
      consent: { initialStatus: 'denied', disablePersistence: true, allowEssentialOnDenied: true },
      domains: ['localhost'],
    });

    track('blocked');
    pageview();
    identify('user-1');

    await flushIfReady(); // no-op but ok to call

    // queue remains empty (non-essential dropped), identify executed immediately
    const consent = getConsent();
    expect(consent?.status).toBe('denied');

    const diag = getDiagnostics();
    expect(diag.facadeQueueSize).toBe(0);
  });

  it('resetConsent() returns to pending', () => {
    init({
      provider: 'noop',
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
      provider: 'noop',
      consent: { initialStatus: 'granted', disablePersistence: true },
      domains: ['localhost'],
    });
    const p = await waitForReady();
    expect(p).toBeTruthy();
  });

  it('identify() + destroy() do not throw via wrappers', async () => {
    init({
      provider: 'noop',
      consent: { initialStatus: 'granted', disablePersistence: true },
      domains: ['localhost'],
    });
    identify('abc');
    await flushIfReady();
    expect(() => destroy()).not.toThrow();
  });
});
