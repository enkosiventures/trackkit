/**
 * Runtime behaviour tests for typed events.
 *
 * Verifies that the generic type parameter does not affect runtime
 * behaviour — events still flow through to the provider correctly
 * after generic erasure at the execute() boundary.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createAnalytics } from '../../../src/factory';
import { createStatefulMock } from '../../helpers/providers';
import { resetTests } from '../../helpers/core';

type TestEvents = {
  signup: { plan: 'free' | 'pro' };
  purchase: { amount: number; currency: string };
};

function resetEnv() {
  history.replaceState(null, '', '/');
  try { localStorage.removeItem('__trackkit_consent__'); } catch {}
  try { Object.defineProperty(navigator, 'doNotTrack', { value: '0', configurable: true }); } catch { (globalThis as any).doNotTrack = '0'; }
}

describe('Typed events — runtime behaviour', () => {
  beforeEach(() => {
    resetTests();
    resetEnv();
  });

  afterEach(() => {
    resetTests();
  });

  it('typed track() calls flow through to the provider with correct arguments', async () => {
    const analytics = createAnalytics<TestEvents>();
    const { stateful, provider } = await createStatefulMock();

    analytics.setProvider(stateful);
    analytics.init({
      autoTrack: false,
      trackLocalhost: true,
      domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'granted' },
    });

    await analytics.waitForReady();

    analytics.track('signup', { plan: 'pro' });
    analytics.track('purchase', { amount: 99, currency: 'USD' });

    expect(provider.diagnostics.eventCalls).toHaveLength(2);
    expect(provider.diagnostics.eventCalls[0]!.name).toBe('signup');
    expect(provider.diagnostics.eventCalls[0]!.props).toEqual({ plan: 'pro' });
    expect(provider.diagnostics.eventCalls[1]!.name).toBe('purchase');
    expect(provider.diagnostics.eventCalls[1]!.props).toEqual({ amount: 99, currency: 'USD' });

    analytics.destroy();
  });

  it('typed instance still handles pageview and identify normally', async () => {
    const analytics = createAnalytics<TestEvents>();
    const { stateful, provider } = await createStatefulMock();

    analytics.setProvider(stateful);
    analytics.init({
      autoTrack: false,
      trackLocalhost: true,
      domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'granted' },
    });

    await analytics.waitForReady();

    analytics.pageview();
    analytics.identify('user-123');

    expect(provider.diagnostics.pageviewCalls).toHaveLength(1);
    expect(provider.diagnostics.identifyCalls).toEqual(['user-123']);

    analytics.destroy();
  });

  it('untyped createAnalytics still works at runtime', async () => {
    const analytics = createAnalytics();
    const { stateful, provider } = await createStatefulMock();

    analytics.setProvider(stateful);
    analytics.init({
      autoTrack: false,
      trackLocalhost: true,
      domains: ['localhost'],
      consent: { disablePersistence: true, initialStatus: 'granted' },
    });

    await analytics.waitForReady();

    analytics.track('any_event', { anything: true });

    expect(provider.diagnostics.eventCalls).toHaveLength(1);
    expect(provider.diagnostics.eventCalls[0]!.name).toBe('any_event');
    expect(provider.diagnostics.eventCalls[0]!.props).toEqual({ anything: true });

    analytics.destroy();
  });
});
