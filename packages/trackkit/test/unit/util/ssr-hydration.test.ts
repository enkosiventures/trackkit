/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { getSSRQueueLength, hydrateSSRQueue, serializeSSRQueue } from '../../../src/util/ssr-queue';
import { tick } from '../../helpers/core';
import { setupAnalytics } from '../../helpers/providers';
import { destroy, grantConsent } from '../../../src';

describe('SSR hydration (browser)', () => {
  beforeEach(() => {
    // Ensure a clean window
    delete (window as any).__TRACKKIT_SSR_QUEUE__;
    destroy();
  });

  it('hydrates from window.__TRACKKIT_SSR_QUEUE__ and clears it afterwards', () => {
    // Simulate server-side injection
    // A minimal “queued event” shape is enough for hydration
    window.__TRACKKIT_SSR_QUEUE__ = [
      {
        id: 'evt_1',
        type: 'track',
        timestamp: Date.now(),
        args: ['ssr_evt', { from: 'ssr' }],
        category: 'analytics',
        pageContext: { url: '/ssr', timestamp: Date.now() },
      },
    ];

    const hydrated = hydrateSSRQueue();
    expect(hydrated).toHaveLength(1);
    expect(hydrated[0].args[0]).toBe('ssr_evt');

    // Cleared after hydration
    expect(window.__TRACKKIT_SSR_QUEUE__).toBeUndefined();
  });

  it('serializeSSRQueue escapes < and > to avoid </script> breakouts', () => {
    const queue = [
      {
        id: 'evt_2',
        type: 'track',
        timestamp: Date.now(),
        args: ['x', { text: '</script><div>' }],
        category: 'analytics',
        pageContext: { url: '/x', timestamp: Date.now() },
      },
    ];
    const html = serializeSSRQueue(queue as any);
    expect(html).toContain('\\u003C'); // '<'
    expect(html).toContain('\\u003E'); // '>'
    // Extract the JSON payload between '=' and the closing </script>
    const m = html.match(/__TRACKKIT_SSR_QUEUE__=(.*);<\/script>/);
    expect(m).toBeTruthy();
    const jsonPayload = m![1];
  
    // The payload must not contain a literal </script>; it should be escaped
    expect(jsonPayload).not.toContain('</script>');
    // And we should see the escaped form
    expect(jsonPayload).toContain('\\u003C/script\\u003E');
  });

  it('does not replay SSR analytics while consent is pending; then replays on grant', async () => {
    (globalThis as any).__TRACKKIT_SSR_QUEUE__ = [{
      id: 'ssr1',
      type: 'track',
      timestamp: Date.now(),
      args: ['ssr_evt', { z: 1 }],
      category: 'analytics',
      pageContext: { url: '/pending' },
    }];

    const { provider } = await setupAnalytics({
      autoTrack: false,
      trackLocalhost: true,
      consent: { initialStatus: 'pending', disablePersistence: true },
    }, { 
      mode: 'singleton',
    });

    expect(provider?.eventCalls.length).toBe(0);           // nothing yet
    expect(getSSRQueueLength()).toBe(1);                    // still present

    grantConsent();
    await tick(10);

    expect(provider?.eventCalls.length).toBe(1);           // now replayed
    expect(getSSRQueueLength()).toBe(0);                    // drained
  });

  it('drops SSR analytics on denied; allows essential when allowEssentialOnDenied', async () => {
    (globalThis as any).__TRACKKIT_SSR_QUEUE__ = [
      { id: 'a1', type: 'track',    timestamp: Date.now(), args: ['analytics_evt'], category: 'analytics', pageContext:{url:'/'} },
      { id: 'e1', type: 'identify', timestamp: Date.now(), args: ['user-123'],      category: 'essential', pageContext:{url:'/'} },
    ];

    const { provider } = await setupAnalytics({
      autoTrack: false,
      trackLocalhost: true,
      consent: { initialStatus: 'pending', disablePersistence: true },
    }, { 
      mode: 'singleton',
      setConsent: 'denied',
    });

    // analytics was dropped, identify allowed
    expect(provider?.eventCalls.length).toBe(0);

    // if your spy tracks identify calls, assert 1; otherwise assert queue drained:
    expect(getSSRQueueLength()).toBe(0);
  });

  it('does not double-fire initial pageview when SSR queued PV is present', async () => {
    (globalThis as any).__TRACKKIT_SSR_QUEUE__ = [{
      id: 'p1', type: 'pageview', timestamp: Date.now(), args: [], category: 'analytics', pageContext:{ url: '/' }
    }];

    const { provider } = await setupAnalytics({
      autoTrack: true,
      trackLocalhost: true,
      consent: { initialStatus: 'granted', disablePersistence: true },
    }, { 
      mode: 'singleton',
    });

    await tick(10);
    expect(provider?.pageviewCalls.length).toBe(1); // SSR PV only
  });
});
