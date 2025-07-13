import { describe, it, expect, beforeEach } from 'vitest';
import { init, track, pageview, destroy, waitForReady, getInstance } from '../src';

describe('Queue and State Integration', () => {
  beforeEach(() => {
    destroy();
  });
  
  it('queues events before initialization completes', async () => {
    // Track events immediately
    track('early_event', { timing: 'before_init' });
    pageview('/early-page');
    
    // Initialize
    init({ debug: true });
    
    // Wait for ready
    const analytics = await waitForReady();
    
    // Verify state
    const state = (analytics as any).getState();
    expect(state.provider).toBe('ready');
  });
  
  it('handles rapid successive calls', () => {
    init();
    const analytics = getInstance();
    
    // Fire many events rapidly
    for (let i = 0; i < 100; i++) {
      track(`event_${i}`, { index: i });
    }
    
    expect(analytics).toBeDefined();
    expect(() => analytics?.destroy()).not.toThrow();
  });
  
  // it('processes events in order', async () => {
  //   const events: string[] = [];
    
  //   // Mock provider that records events
  //   const mockProvider = {
  //     track: (name: string) => events.push(`track:${name}`),
  //     pageview: (url?: string) => events.push(`pageview:${url}`),
  //     identify: (id: string | null) => events.push(`identify:${id}`),
  //     setConsent: () => {},
  //     destroy: () => {},
  //   };
    
  //   // Monkey-patch the provider loader
  //   const loader = require('../src/provider-loader');
  //   const original = loader.loadProvider;
  //   loader.loadProvider = async () => ({
  //     ...mockProvider,
  //     init: async () => {},
  //     getState: () => ({}),
  //   });
    
  //   // Queue events before init
  //   track('first');
  //   pageview('/second');
  //   identify('third');
    
  //   // Initialize and wait
  //   init();
  //   await waitForReady();
    
  //   // Add more events
  //   track('fourth');
    
  //   // Verify order
  //   expect(events).toEqual([
  //     'track:first',
  //     'pageview:/second',
  //     'identify:third',
  //     'track:fourth',
  //   ]);
    
  //   // Restore
  //   loader.loadProvider = original;
  // });
});