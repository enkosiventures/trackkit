/**
 * @vitest-environment node
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { track, pageview, destroy } from '../../../src';
import { getSSRQueue, serializeSSRQueue } from '../../../src/util/ssr-queue';

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
    import('../../../src').then(({ getInstance }) => {
      expect(getInstance()).toBeNull();
    });
  });
});