import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBatchProcessor, type Batch } from '../../../src/dispatcher/batch-processor';
import { nextTick } from '../../helpers/core';

// const nextTick = () => new Promise(r => setTimeout(r, 0));

describe('EventBatchProcessor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('splits batches by maxSize', async () => {
    const sent: Batch[] = [];
    const bp = new EventBatchProcessor({ maxSize: 2, maxWait: 10 }, async (b) => { sent.push(b); });

    bp.add({ id: 'a', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: 10 });
    bp.add({ id: 'b', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: 10 });
    // adding the 3rd forces split
    bp.add({ id: 'c', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: 10 });

    // allow the forced send; then auto-timeout flush for the final batch
    await nextTick();
    vi.advanceTimersByTime(11);
    await nextTick();

    await bp.flush();

    expect(sent.length).toBe(2);
    expect(sent[0].events.map(e => e.id)).toEqual(['a', 'b']);
    expect(sent[1].events.map(e => e.id)).toEqual(['c']);
  });

  it('splits batches by maxBytes', async () => {
    const sent: Batch[] = [];
    const bp = new EventBatchProcessor({ maxBytes: 100, maxWait: 10 }, async (b) => { sent.push(b); });

    const bigPayload = { data: 'x'.repeat(150) }; // > 100 bytes after JSON
    bp.add({ id: 'x', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: JSON.stringify(bigPayload).length });

    vi.advanceTimersByTime(11);
    await nextTick();
    await bp.flush();

    expect(sent.length).toBe(1);
    expect(sent[0].events.map(e => e.id)).toEqual(['x']);
  });

  it('deduplicates by id when enabled', async () => {
    const sent: Batch[] = [];
    const bp = new EventBatchProcessor({ maxWait: 10, deduplication: true }, async (b) => { sent.push(b); });

    bp.add({ id: 'dup', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: 10 });
    bp.add({ id: 'dup', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: 10 });

    vi.advanceTimersByTime(11);
    await nextTick();
    await bp.flush();

    expect(sent.length).toBe(1);
    expect(sent[0].events.map(e => e.id)).toEqual(['dup']);
  });

  it('retries failed batches with backoff (retryable error)', async () => {
    const sent: { id: string; attempt: number }[] = [];
    let attempts = 0;

    const bp = new EventBatchProcessor(
      { maxWait: 1, retry: { maxAttempts: 3, initialDelay: 100, multiplier: 2, maxDelay: 1000, jitter: false } },
      async (b) => {
        attempts++;
        sent.push({ id: b.id, attempt: attempts });
        // fail the first 2 attempts; succeed on 3rd
        if (attempts < 3) {
          const err: any = new Error('Service unavailable');
          err.status = 503; // retryable
          throw err;
        }
      }
    );

    bp.add({ id: 'r1', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: 10 });

    vi.advanceTimersByTime(5);
    await vi.runOnlyPendingTimersAsync(); // processes timers + microtasks in between steps
    vi.advanceTimersByTime(100);
    await vi.runOnlyPendingTimersAsync();
    vi.advanceTimersByTime(200);
    await vi.runOnlyPendingTimersAsync();
    await bp.flush();

    expect(attempts).toBe(3);
    expect(sent[0].attempt).toBe(1);
    expect(sent[1].attempt).toBe(2);
    expect(sent[2].attempt).toBe(3);
  });

  it('does not retry non-retryable errors', async () => {
    let attempts = 0;
    const bp = new EventBatchProcessor({ maxWait: 1, retry: { maxAttempts: 3, initialDelay: 100, jitter: false } },
      async () => {
        attempts++;
        const err: any = new Error('Bad Request');
        err.status = 400; // not retryable
        throw err;
      });

    bp.add({ id: 'bad', timestamp: Date.now(), type: 'track', payload: { run() {} }, size: 10 });

    vi.advanceTimersByTime(5);
    await nextTick();
    await bp.flush();

    expect(attempts).toBe(1);
  });
});
