import { describe, it, expect, vi } from 'vitest';

// We need to mock *before* importing the facade
vi.mock('../../src/providers/loader', () => {
  let call = 0;
  return {
    loadProvider: vi.fn(async () => {
      call += 1;
      if (call === 1) {
        // first attempt: provider load fails
        throw new Error('boom');
      }
      // second attempt: fallback noop provider
      const spy = {
        name: 'noop',
        onReady(cb: () => void) { cb(); },
        getState() { return { provider: 'ready', history: [] as any[] }; },
        track: () => {},
        pageview: () => {},
        identify: () => {},
        destroy: () => {},
      };
      // facade expects a StatefulProvider-like shape; this is sufficient at runtime
      return spy as any;
    }),
  };
});

import { AnalyticsFacade } from '../../../src/facade';
import { tick } from '../../helpers/core';
import { TEST_SITE_ID } from '../../setup/providers';

describe('Provider loader fallback', () => {
  it('falls back to noop when initial load fails', async () => {
    const facade = new AnalyticsFacade();
    facade.init({
      debug: true,
      site: TEST_SITE_ID.plausible,
      provider: 'plausible', // simulate failing provider
      domains: ['localhost'],
      consent: { initialStatus: 'granted', disablePersistence: true },
    });

    await tick(10);
    // After fallback, facade should be usable (no throws)
    expect(() => facade.pageview()).not.toThrow();
    expect(() => facade.track('ok')).not.toThrow();
  });
});
