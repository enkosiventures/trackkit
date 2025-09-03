import { describe, it, expect } from 'vitest';
import { AnalyticsFacade } from '../../../src/facade';
import { getSSRQueueLength } from '../../../src/util/ssr-queue';
import { tick } from '../../helpers/core';
import { waitForReady } from '../../../src/facade/singleton';

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
    const spy = spyProvider();
    facade.setProvider(spy);

    await tick(5); // let any async init settle

    facade.init({
      debug: true,
      autoTrack: false,
      trackLocalhost: true,
      domains: ['localhost'],
      consent: { initialStatus: 'granted', disablePersistence: true },
    });

    await tick(20);

    console.warn('Provider name:', facade.getProvider()?.name)
    expect(spy._get().eventCalls.length).toBe(1);
    expect(getSSRQueueLength()).toBe(0); // hydrate clears the queue
  });
});
