import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NetworkDispatcher } from '../../../src/dispatcher/network-dispatcher';
import * as TransportsMod from '../../../src/dispatcher/transports';

const sleep = (ms = 0) => new Promise(res => setTimeout(res, ms));

class SpyTransport implements TransportsMod.Transport {
  // shape compatible with Transport
  public id = `mock_${Math.random().toString(36).slice(2)}`;
  send = vi.fn(async (_: {url: string, body: unknown, init?: RequestInit}) => {});
}

describe('NetworkDispatcher (provider-side, per-event sends)', () => {
  let t: SpyTransport;

  beforeEach(() => {
    t = new SpyTransport();
    vi.spyOn(TransportsMod, 'resolveTransport').mockReturnValue(t as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends immediately when batching is disabled (per-event)', async () => {
    const nd = new NetworkDispatcher({ defaultHeaders: { 'X-Test': '1' } });

    await nd.send({ url: 'https://api.test/collect', body: { a: 1 }, init: { headers: { Foo: 'Bar' } } });
    await nd.send({ url: 'https://api.test/collect', body: { b: 2 } });

    expect(t.send.mock.calls.length).toBe(2);

    // first call
    const firstCall = t.send.mock.calls[0][0] as any;
    expect(firstCall.url).toBe('https://api.test/collect');
    expect(firstCall.body).toEqual({ a: 1 });
    expect(firstCall.init.headers).toMatchObject({ 'X-Test': '1', Foo: 'Bar' });

    // second call
    const secondCall = t.send.mock.calls[1][0] as any;
    expect(secondCall.body).toEqual({ b: 2 });
    expect(secondCall.init.headers).toMatchObject({ 'X-Test': '1' });
  });


  it('flushes by maxWait timer; destroy cancels timers', async () => {
    // 1) Fake timers BEFORE constructing the dispatcher
    vi.useFakeTimers();

    const nd = new NetworkDispatcher({
      batching: { enabled: true, maxSize: 10, maxWait: 100 },
    });

    await nd.send({ url: 'https://api.test/collect', body: { a: 1 } });
    expect(t.send.mock.calls.length).toBe(0);

    // 2) Advance timers with the async helper and let microtasks settle
    await vi.advanceTimersByTimeAsync(100);
    await Promise.resolve();

    expect(t.send.mock.calls.length).toBe(1);
    expect(t.send.mock.calls[0][0].body).toEqual({ a: 1 });

    await nd.send({ url: 'https://api.test/collect', body: { b: 2 } });
    nd.destroy();

    // Timer that would flush 'b' should be cancelled by destroy()
    await vi.advanceTimersByTimeAsync(200);
    await Promise.resolve();

    expect(t.send.mock.calls.length).toBe(1);

    // 3) Return to real timers at the end of THIS test
    vi.useRealTimers();
  });

  it('respects maxBytes and splits (per-event sends)', async () => {
    const nd = new NetworkDispatcher({
      batching: { enabled: true, maxSize: 100, maxBytes: 300 },
    });

    await nd.send({ url: 'https://api.test/collect', body: { a: 'x'.repeat(120) } });
    await nd.send({ url: 'https://api.test/collect', body: { b: 'x'.repeat(120) } });
    await nd.send({ url: 'https://api.test/collect', body: { c: 'x'.repeat(120) } });

    await nd.flush(); // flush remainder
    expect(t.send.mock.calls.length).toBe(3);
    const bodies = t.send.mock.calls.map(([payload]) => payload.body);
    expect(bodies).toEqual([
      { a: expect.any(String) },
      { b: expect.any(String) },
      { c: expect.any(String) },
    ]);
  });

  it('runs sealed batches concurrently (batch-level), events inside batch serial', async () => {
    const nd = new NetworkDispatcher({
      batching: { enabled: true, maxSize: 2, maxWait: 1, concurrency: 2 },
    });

    // Enqueue 5 → batches: [1,2], [3,4], then remainder [5] flushed later
    await nd.send({ url: 'u', body: { i: 1 } });
    await nd.send({ url: 'u', body: { i: 2 } }); // current full, not yet sealed
    await nd.send({ url: 'u', body: { i: 3 } }); // seals [1,2], starts [3]
    await nd.send({ url: 'u', body: { i: 4 } }); // fills [3,4]
    await Promise.resolve(); // allow both batches to start
    // Two batches sealed → 4 per-event sends total once they finish
    await nd.flush();
    expect(t.send.mock.calls.length).toBe(4);

    // final remainder (5)
    await nd.send({ url: 'u', body: { i: 5 } });
    await nd.flush();
    expect(t.send.mock.calls.length).toBe(5);

    // Bodies still in enqueue order per batch
    const bodies = t.send.mock.calls.map(([payload]) => payload.body);
    expect(bodies.slice(0, 4)).toEqual([{ i: 1 }, { i: 2 }, { i: 3 }, { i: 4 }]);
    expect(bodies[4]).toEqual({ i: 5 });
  });

  it('retries retryable failures according to policy', async () => {
    vi.useFakeTimers();              // <-- before creating dispatcher

    // one fail, then success
    let first = true;
    const t = new SpyTransport();
    t.send.mockImplementation(async () => {
      if (first) {
        first = false;
        const e: any = new Error('temporary');
        // match what your batcher checks:
        e.status = 503;
        e.retryable = true;
        throw e;
      }
    });

    // return the *same* instance every time
    vi.spyOn(TransportsMod, 'resolveTransport').mockImplementation(() => t as any);

    const nd = new NetworkDispatcher({
      batching: {
        enabled: true,
        maxSize: 1,           // seal immediately so retry loop runs now
        maxWait: 0,
        retry: {
          maxAttempts: 2,     // 1 failure + 1 retry
          initialDelay: 0,
          maxDelay: 0,
          multiplier: 1,
          jitter: false,
          retryableStatuses: [503],
        },
      },
    });

    await nd.send({ url: 'https://api.test/collect', body: { ok: true } });
    await nd.flush(); // kicks off first attempt

    // Let the retry timer fire and microtasks settle
    await vi.runAllTimersAsync();   // <-- key: runs the scheduled retry
    await Promise.resolve();

    expect(t.send.mock.calls.length).toBe(2); // fail + retry
    vi.useRealTimers();
  });


  it('flushes the first full batch on the next enqueue (exactly 2 sends)', async () => {
    const nd = new NetworkDispatcher({
      batching: { enabled: true, maxSize: 2, maxWait: 10, concurrency: 2 },
    });

    await nd.send({ url: 'https://api.test/collect', body: { x: 1 } });
    await nd.send({ url: 'https://api.test/collect', body: { x: 2 } });

    // no split yet
    expect(t.send.mock.calls.length).toBe(0);

    // this enqueue triggers split+flush of the first two
    await nd.send({ url: 'https://api.test/collect', body: { x: 3 } });

    // allow macrotask queue to run the batch send
    await sleep(0);
    await sleep(0);

    expect(t.send.mock.calls.length).toBe(2);
    const firstBodies = t.send.mock.calls.slice(0, 2).map(([payload]) => payload.body);
    expect(firstBodies).toEqual([{ x: 1 }, { x: 2 }]);

    // the third item remains pending in the new batch; don’t flush here.
  });

  it('splits at maxSize (2 sends) and flush() sends the remainder (+1)', async () => {
    const nd = new NetworkDispatcher({
      batching: { enabled: true, maxSize: 2, maxWait: 10, concurrency: 2 },
    });

    await nd.send({ url: 'https://api.test/collect', body: { x: 1 } });
    await nd.send({ url: 'https://api.test/collect', body: { x: 2 } });
    await nd.send({ url: 'https://api.test/collect', body: { x: 3 } });

    // let the split run
    await sleep(0);
    await sleep(0);

    expect(t.send.mock.calls.length).toBe(2);
    const batch1 = t.send.mock.calls.slice(0, 2).map(([payload]) => payload.body);
    expect(batch1).toEqual([{ x: 1 }, { x: 2 }]);

    await nd.flush();
    expect(t.send.mock.calls.length).toBe(3);
    const last = t.send.mock.calls[2][0].body;
    expect(last).toEqual({ x: 3 });
  });
});
