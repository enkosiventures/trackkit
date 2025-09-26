import { describe, it, expect } from 'vitest';
import { PerformanceTracker } from '../../../src/performance/tracker';

describe('PerformanceTracker', () => {
  it('tracks processing time and totals', () => {
    const p = new PerformanceTracker();
    p.markInitStart();
    // simulate some work
    p.trackEvent(() => {});
    p.markInitComplete();

    expect(p.metrics.totalEvents).toBe(1);
    expect(p.metrics.avgProcessingTime).toBeGreaterThanOrEqual(0);
    expect(p.metrics.initTime).toBeGreaterThanOrEqual(0);
  });

  it('wraps network latency', async () => {
    const p = new PerformanceTracker();
    const res = await p.trackNetworkRequest('send', async () => {
      await new Promise(r => setTimeout(r, 5));
      return 123;
    });
    expect(res).toBe(123);
    expect(p.metrics.avgNetworkLatency).toBeGreaterThan(0);
  });
});
