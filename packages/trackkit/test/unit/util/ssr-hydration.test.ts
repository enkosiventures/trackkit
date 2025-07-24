/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { hydrateSSRQueue, serializeSSRQueue } from '../../../src/util/ssr-queue';

describe('SSR hydration (browser)', () => {
  beforeEach(() => {
    // Ensure a clean window
    delete (window as any).__TRACKKIT_SSR_QUEUE__;
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
});
