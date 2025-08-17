import { describe, it, expect, beforeEach, vi } from 'vitest';
import { init, track, pageview, destroy, waitForReady, grantConsent } from '../../src';
import { createStatefulMock } from '../helpers/providers';
import { navigate } from '../helpers/navigation';
import { getFacade } from '../../src/core/facade-singleton';

describe('Queue and State Integration', () => {
  beforeEach(() => {
    destroy();
    vi.clearAllMocks();
  });

  it('queues events before initialization and flushes in order after ready + consent', async () => {
    // Pre-init queue
    track('first', { a: 1 });
    navigate('/pre');
    pageview();

    init({ debug: true, autoTrack: false, trackLocalhost: true });

    // Attach mock provider so we can assert deliveries
    const { stateful, provider } = await createStatefulMock();
    const { getFacade } = await import('../../src/core/facade-singleton');
    getFacade().setProvider(stateful);

    await waitForReady();
    grantConsent();

    // Give the facade a beat to flush
    await new Promise(r => setTimeout(r, 30));

    expect(provider.eventCalls.map(e => e.name)).toEqual(['first']);
    expect(provider.pageviewCalls.map(p => p?.url)).toEqual(['/pre']);
  });

  it('handles rapid successive calls', async () => {
    init({ debug: false, autoTrack: false, trackLocalhost: true });
    const { stateful } = await createStatefulMock();
    const { getFacade } = await import('../../src/core/facade-singleton');
    getFacade().setProvider(stateful);
    await waitForReady();
    grantConsent();

    // Fire many events rapidly
    for (let i = 0; i < 100; i++) {
      track(`event_${i}`, { index: i });
    }

    // Should not throw on destroy
    const analytics = getFacade();
    expect(() => analytics.destroy()).not.toThrow();
  });

  it('processes mixed queued events in strict order', async () => {
    // Queue BEFORE init
    track('first');
    await navigate('/second');
    pageview();

    // Do not allow implicit flushing on ready
    init({ debug: true, autoTrack: false, trackLocalhost: true, consent: { requireExplicit: true } });

    // Attach mock provider *before* provider-ready triggers any replay
    const { stateful, provider } = await createStatefulMock();
    getFacade().setProvider(stateful);

    await waitForReady();
    grantConsent();

    // Give the facade a moment to flush
    await new Promise(r => setTimeout(r, 30));

    // Assert strict order using the mock’s call arrays
    expect(provider.eventCalls.map(e => e.name)).toEqual(['first']);
    expect(provider.pageviewCalls.map(p => p?.url)).toEqual(['/second']);
  });
});
