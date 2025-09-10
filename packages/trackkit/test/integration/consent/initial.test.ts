// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createMockFacade } from '../../helpers/providers';
import { grantConsent, destroy } from '../../../src';

// Small tick helper to allow async callbacks/flushes to run
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('Consent: initial state behavior', () => {
  beforeEach(() => {
    // Clean consent persistence between tests
    try {
      localStorage.removeItem('__trackkit_consent__');
    } catch {/* no-op */}
    destroy();
  });

  afterEach(() => {
    try {
      localStorage.removeItem('__trackkit_consent__');
    } catch {/* no-op */}
    destroy();
  });

  it("initial: 'denied' drops non-essential events (no queue), pageview & track blocked", async () => {
    const { facade, provider } = await createMockFacade({
      provider: 'noop',
      autoTrack: false,
      domains: ['localhost'],
      trackLocalhost: true,
      consent: {
        initialStatus: 'denied',
        allowEssentialOnDenied: false,
        disablePersistence: true,
      },
    });

    await facade.init?.();
    await facade.waitForReady();

    // Non-essential
    facade.pageview();
    facade.track('e1', { a: 1 });

    // Essential (should be blocked with allowEssentialOnDenied: false)
    facade.identify('user-123');

    await tick();

    expect(provider.pageviewCalls.length).toBe(0);
    expect(provider.eventCalls.length).toBe(0);
    expect(provider.identifyCalls.length).toBe(0);

    // No queueing under denied
    expect(facade.getQueueSize()).toBe(0);
  });

  it("initial: 'denied' allows essential only when allowEssentialOnDenied = true", async () => {
    const { facade, provider } = await createMockFacade({
      provider: 'noop',
      autoTrack: false,
      domains: ['localhost'],
      trackLocalhost: true,
      consent: {
        initialStatus: 'denied',
        allowEssentialOnDenied: true,
        disablePersistence: true,
      },
    });

    await facade.init?.();
    await facade.waitForReady();

    // Essential allowed
    facade.identify('u-1');

    // Non-essential dropped
    facade.pageview();
    facade.track('e1');

    await tick();

    expect(provider.identifyCalls.length).toBe(1);
    expect(provider.identifyCalls[0]).toBe('u-1');

    expect(provider.pageviewCalls.length).toBe(0);
    expect(provider.eventCalls.length).toBe(0);
    expect(facade.getQueueSize()).toBe(0);
  });

  it("initial: 'pending' queues & flushes on grant", async () => {
    const { facade, provider } = await createMockFacade({
      provider: 'noop',
      autoTrack: false,
      domains: ['localhost'],
      trackLocalhost: true,
      consent: {
        initialStatus: 'pending',
        disablePersistence: true,
      },
    });

    await facade.init?.();
    await facade.waitForReady();

    // Queued under pending
    facade.track('queued_event', { x: 1 });
    expect(facade.getQueueSize()).toBe(1);

    // Grant -> should flush
    grantConsent();
    await tick();

    expect(facade.getQueueSize()).toBe(0);
    expect(provider.eventCalls.length).toBe(1);
    expect(provider.eventCalls[0]?.name).toBe('queued_event');
  });

  it("initial: 'granted' sends immediately", async () => {
    const { facade, provider } = await createMockFacade({
      provider: 'noop',
      autoTrack: false,
      domains: ['localhost'],
      trackLocalhost: true,
      consent: {
        initialStatus: 'granted',
        disablePersistence: true,
      },
    });

    await facade.init?.();
    await facade.waitForReady();

    facade.pageview();
    facade.track('immediate');

    await tick();

    expect(provider.pageviewCalls.length).toBe(1);
    expect(provider.eventCalls.length).toBe(1);
    expect(provider.eventCalls[0]?.name).toBe('immediate');
    expect(facade.getQueueSize()).toBe(0);
  });

  it('stored consent overrides initial (stored granted persists)', async () => {
    // First run: persist granted
    {
      const { facade } = await createMockFacade({
        provider: 'noop',
        autoTrack: false,
        domains: ['localhost'],
        trackLocalhost: true,
        consent: {
          initialStatus: 'pending',
          disablePersistence: false, // persist for this test
        },
      });
      await facade.init?.();
      await facade.waitForReady();

      grantConsent();
      await tick();
      destroy();
    }

    // Second run: initial denied but stored granted should win
    const { facade, provider } = await createMockFacade({
      provider: 'noop',
      autoTrack: false,
      domains: ['localhost'],
      trackLocalhost: true,
      consent: {
        initialStatus: 'denied',
        disablePersistence: false,
      },
    });

    await facade.init?.();
    await facade.waitForReady();
    facade.track('should_send_immediately');

    await tick();

    expect(provider.eventCalls.length).toBe(1);
    expect(provider.eventCalls[0]?.name).toBe('should_send_immediately');
    expect(facade.getQueueSize()).toBe(0);
  });

  it('policy version reset respects initial', async () => {
    // Seed storage as if user had previously granted under policy v1
    try {
      localStorage.setItem(
        '__trackkit_consent__',
        JSON.stringify({ status: 'granted', policyVersion: 'v1', updatedAt: Date.now() })
      );
    } catch {/* no-op */}

    const { facade, provider } = await createMockFacade({
      provider: 'noop',
      autoTrack: false,
      domains: ['localhost'],
      trackLocalhost: true,
      consent: {
        // New policy version should invalidate stored, then apply initial
        policyVersion: 'v2',
        initialStatus: 'denied',
        disablePersistence: false,
      },
    });

    await facade.init?.();
    await facade.waitForReady();

    // Under new policy, we should be denied
    facade.track('blocked');
    facade.pageview();
    await tick();

    expect(provider.eventCalls.length).toBe(0);
    expect(provider.pageviewCalls.length).toBe(0);
    expect(facade.getQueueSize()).toBe(0);
  });
});