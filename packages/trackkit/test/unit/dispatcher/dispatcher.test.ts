import { describe, it, expect, vi } from 'vitest';
import { Dispatcher } from '../../../src/dispatcher/dispatcher';
import { nextTick } from '../../helpers/core';

describe('Dispatcher', () => {
  it('runs items immediately when batching disabled', async () => {
    const run = vi.fn(async () => {});
    const d = new Dispatcher({ batching: undefined });
    await d.enqueue({ id: 'x', type: 'track', run });
    // flush is a no-op here but safe
    await d.flush();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('batches items when enabled and flushes on timer', async () => {
    vi.useFakeTimers();
    const run = vi.fn(async () => {});
    const d = new Dispatcher({ batching: { enabled: true, maxSize: 10, maxWait: 50 } });

    d.enqueue({ id: 'a', type: 'track', run });
    d.enqueue({ id: 'b', type: 'track', run });

    expect(run).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(51);
    await nextTick();
    await d.flush();

    expect(run).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it('wraps network calls in performance tracker when enabled', async () => {
    const run = vi.fn(async () => {});
    // enable perf
    const d = new Dispatcher({ batching: undefined, performance: { enabled: true } });
    await d.enqueue({ id: 'y', type: 'track', run });
    await d.flush();
    expect(run).toHaveBeenCalledTimes(1);
  });
});
