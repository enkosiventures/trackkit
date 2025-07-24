import { describe, it, expect } from 'vitest';
import { AnalyticsFacade } from '../../../src/core/facade';
import { getSSRQueueLength } from '../../../src/util/ssr-queue';
import { tick } from '../../helpers/core';

function spyProvider() {
  const eventCalls: any[] = [];
  const pageviewCalls: any[] = [];
  return {
    name: 'spy',
    onReady(cb: () => void) { cb(); },
    getState() { return { provider: 'ready', history: [] as any[] }; },
    track: (...args: any[]) => { eventCalls.push(args); },
    pageview: (...args: any[]) => { pageviewCalls.push(args); },
    identify: () => {},
    destroy: () => {},
    _get() { return { eventCalls, pageviewCalls }; },
  };
}

describe('SSR hydration', () => {
  it('replays SSR events when provider ready and consent granted', async () => {
    // Seed the exact key hydrateSSRQueue() reads
    (globalThis as any).__TRACKKIT_SSR_QUEUE__ = [{
      id: 'ssr1',
      type: 'track',
      timestamp: Date.now(),
      args: ['ssr_event', { z: 1 }],
      category: 'analytics',         // OK when consent is granted
      pageContext: { url: '/from-ssr' },
    }];

    const facade = new AnalyticsFacade();
    facade.init({
      debug: true,
      autoTrack: false,
      trackLocalhost: true,
      domains: ['localhost'],
      consent: { initialStatus: 'granted', disablePersistence: true },
    });

    const spy = spyProvider();
    // @ts-expect-error test helper
    facade.setProvider(spy);

    await tick(20);

    expect(spy._get().eventCalls.length).toBe(1);
    expect(getSSRQueueLength()).toBe(0); // hydrate clears the queue
  });
});
