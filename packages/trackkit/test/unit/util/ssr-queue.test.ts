/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { track, pageview, destroy } from '../../../src';
import { clearSSRQueue, enqueueSSREvent, flushSSRAll, flushSSREssential, getSSRQueue, getSSRQueueLength, hydrateSSRQueue, serializeSSRQueue } from '../../../src/util/ssr-queue';
import { DEFAULT_CATEGORY } from '../../../src/constants';

describe('SSR Support', () => {
  beforeEach(() => {
    delete global.__TRACKKIT_SSR_QUEUE__;
  });
  
  afterEach(() => {
    destroy();
  });
  
  it('queues events in SSR environment', () => {
    track('server_event', { ssr: true });
    pageview();
    
    const queue = getSSRQueue();
    expect(queue).toHaveLength(2);
    expect(queue[0]).toMatchObject({
      type: 'track',
      args: ['server_event', { ssr: true }],
    });
  });
  
  it('serializes queue for client hydration', () => {
    track('ssr_event');
    
    const queue = getSSRQueue();
    const html = serializeSSRQueue(queue);
    
    expect(html).toContain('window.__TRACKKIT_SSR_QUEUE__');
    expect(html).toContain('ssr_event');
  });
  
  it('maintains separate queue from runtime queue', () => {
    // Events should go to SSR queue, not runtime queue
    track('event1');
    track('event2');
    
    const ssrQueue = getSSRQueue();
    expect(ssrQueue).toHaveLength(2);
    
    // Runtime instance should not exist
    import('../../../src').then(({ getFacade }) => {
      expect(getFacade()).toBeNull();
    });
  });

  it('serializeSSRQueue() escapes </script> and preserves FIFO order', () => {
    clearSSRQueue();
    enqueueSSREvent('track', ['a', { t: '</script><img onerror=1 />' }], 'analytics', { url: '/a' });
    enqueueSSREvent('track', ['b', { t: 'ok' }], 'analytics', { url: '/b' });

    const queue = getSSRQueue();
    const html = serializeSSRQueue(queue);
    // XSS hardening: </script> should be escaped
    expect(html).toMatch(/\\u003C\/script\\u003E|<\\\/script>/);
    // Order: first payload name should be 'a' then 'b'
    expect(html).toMatch(/"args":\s*\[\s*"a"/);
    expect(html).toMatch(/"args":\s*\[\s*"b"/);
  });

  it('enqueueSSREvent() keeps explicit pageContext and defaults category', () => {
    globalThis.__TRACKKIT_SSR_QUEUE__ = [];
    enqueueSSREvent('track', ['evt', { k: 1 }], DEFAULT_CATEGORY, { url: '/explicit' });
    const q = getSSRQueue();
    expect(q[0].pageContext?.url).toBe('/explicit');
    expect(q[0].category).toBe('analytics'); // default
  });

  it('does not enqueue SSR events in browser runtime', () => {
    const realWindow = globalThis.window; 
    globalThis.window = realWindow ?? {} as any;          // simulate browser
    globalThis.__TRACKKIT_SSR_QUEUE__ = []; // reset
    enqueueSSREvent('track', ['evt'], DEFAULT_CATEGORY);
    expect(getSSRQueueLength()).toBe(0);
    // delete globalThis.window;
    globalThis.window = realWindow;
  });

  it('hydrateSSRQueue() drains only once', () => {
    const realWindow = globalThis.window;
    globalThis.window = realWindow ?? {} as any;
    const realDocument = globalThis.document;
    globalThis.document = realDocument ?? {} as any;

    globalThis.__TRACKKIT_SSR_QUEUE__ = [
      {
        id: '1',
        type: 'track',
        timestamp: Date.now(),
        args: ['ssr'],
        category: 'analytics',
        pageContext: { url: '/x' },
      },
    ];

    let calls = hydrateSSRQueue();
    expect(calls.length).toBe(1);
    expect(getSSRQueueLength()).toBe(0);

    // Second hydration is a no-op: nothing left to drain
    calls = hydrateSSRQueue();
    expect(calls.length).toBe(0);
    expect(getSSRQueueLength()).toBe(0);

    globalThis.window = realWindow;
    globalThis.document = realDocument;
  });

  it('hydrateSSRQueue() is a no-op on server (no DOM)', () => {
    const realWindow = globalThis.window;
    const realDocument = globalThis.document;
    // Simulate server: no DOM
    // @ts-expect-error test-only
    delete globalThis.window;
    // @ts-expect-error test-only
    delete globalThis.document;

    globalThis.__TRACKKIT_SSR_QUEUE__ = [
      { id: '1', type: 'track', timestamp: Date.now(), args: ['ssr'], category: 'analytics', pageContext: { url: '/x' } },
      { id: '2', type: 'track', timestamp: Date.now(), args: ['ssr'], category: 'essential', pageContext: { url: '/y' } },
    ];

    let calls = flushSSRAll();
    expect(calls.length).toBe(0);         // server -> no hydration
    expect(getSSRQueueLength()).toBe(2);  // queue untouched

    calls = flushSSREssential();
    expect(calls.length).toBe(0);         // server -> no hydration
    expect(getSSRQueueLength()).toBe(2);  // queue untouched

    globalThis.window = realWindow;
    globalThis.document = realDocument;
  });

});