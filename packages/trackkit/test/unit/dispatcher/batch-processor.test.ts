import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventBatchProcessor } from '../../../src/dispatcher/batch-processor';
import { microtick } from '../../helpers/core';
import { Batch } from '../../../src/dispatcher/types';
import { applyBatchingDefaults, applyRetryDefaults } from '../../../src/facade/normalize';


describe('EventBatchProcessor', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('splits batches by maxSize', async () => {
    const sent: Batch[] = [];
    const bp = new EventBatchProcessor({
      batching: applyBatchingDefaults({ maxSize: 2, maxWait: 10 }),
      sendFn: async (b) => { sent.push(b); },
    });

    bp.add({ id: 'a', timestamp: Date.now(), payload: { url: '', body: { a: 1 }}, size: 10 });
    bp.add({ id: 'b', timestamp: Date.now(), payload: { url: '', body: { b: 2 }}, size: 10 });
    // adding the 3rd forces split
    bp.add({ id: 'c', timestamp: Date.now(), payload: { url: '', body: { c: 3 }}, size: 10 });

    // allow the forced send; then auto-timeout flush for the final batch
    await microtick();
    vi.advanceTimersByTime(11);
    await microtick();

    await bp.flush();

    expect(sent.length).toBe(2);
    expect(sent[0].events.map(e => e.id)).toEqual(['a', 'b']);
    expect(sent[1].events.map(e => e.id)).toEqual(['c']);
  });

  it('splits batches by maxBytes', async () => {
    const sent: Batch[] = [];
    const bp = new EventBatchProcessor({
      batching: applyBatchingDefaults({ maxBytes: 100, maxWait: 10 }),
      sendFn: async (b) => { sent.push(b); },
    });

    const bigPayload = { data: 'x'.repeat(150) }; // > 100 bytes after JSON
    bp.add({ id: 'x', timestamp: Date.now(), payload: { url: '', body: { a: 1 }}, size: JSON.stringify(bigPayload).length });

    vi.advanceTimersByTime(11);
    await microtick();
    await bp.flush();

    expect(sent.length).toBe(1);
    expect(sent[0].events.map(e => e.id)).toEqual(['x']);
  });

  it('deduplicates by id when enabled', async () => {
    const sent: Batch[] = [];
    const bp = new EventBatchProcessor({
      batching: applyBatchingDefaults({ maxWait: 10, deduplication: true }),
      sendFn: async (b) => { sent.push(b); }
    });

    bp.add({ id: 'dup', timestamp: Date.now(), payload: { url: '', body: { a: 1 }}, size: 10 });
    bp.add({ id: 'dup', timestamp: Date.now(), payload: { url: '', body: { b: 2 }}, size: 10 });

    vi.advanceTimersByTime(11);
    await microtick();
    await bp.flush();

    expect(sent.length).toBe(1);
    expect(sent[0].events.map(e => e.id)).toEqual(['dup']);
  });
});
