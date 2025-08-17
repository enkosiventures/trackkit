import { describe, it, expect, beforeEach } from 'vitest';
import {
  init,
  getInstance,
  destroy,
  waitForReady,
  track,
  hasQueuedEvents,
  grantConsent,
  flushIfReady,
} from '../../../src';
import { createStatefulMock } from '../../helpers/providers';
import { getFacade } from '../../../src/core/facade-singleton';

describe('Singleton behavior', () => {
  beforeEach(() => {
    destroy();
  });

  it('reuses the same internal instance after multiple init calls', async () => {
    init({ provider: 'noop', autoTrack: false });
    const instance1 = await waitForReady();

    // Should not re-initialize a new facade
    init();
    const instance2 = await waitForReady();

    expect(instance1).toBe(instance2);
  });

  it('creates a new instance after destroy', async () => {
    init({ autoTrack: false });
    const first = await waitForReady();
    destroy();
    init({ autoTrack: false });
    const second = await waitForReady();

    expect(first).not.toBe(second);
  });

  it('maintains instance across imports', async () => {
    init({ autoTrack: false });
    const { getInstance: getInstanceAgain } = await import('../../../src');
    expect(getInstance()).toBe(getInstanceAgain());
  });

  it('exposes queue helpers that reflect pre-init calls and flush after consent', async () => {
    // Queue something before init
    track('early');
    expect(hasQueuedEvents()).toBe(true);

    // Init + attach a mock provider for observation
    init({ autoTrack: false, trackLocalhost: true });
    const { stateful, provider } = await createStatefulMock();
    getFacade().setProvider(stateful);

    await waitForReady();
    grantConsent();
    await flushIfReady();
    await new Promise(r => setTimeout(r, 20));

    expect(provider.eventCalls.map(e => e.name)).toEqual(['early']);
  });
});