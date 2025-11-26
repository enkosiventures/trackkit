import { applyBatchingDefaults, applyResilienceDefaults } from '../facade/normalize';
import type { PerformanceTracker } from '../performance/tracker';
import { EventBatchProcessor } from './batch-processor';
import type { Transport } from './transports';
import { resolveTransport } from './transports';
import type { DispatchPayload, NetworkDispatcherOptions } from './types';


function mergeHeaders(
  a?: Headers | Record<string, any>,
  b?: Headers | Record<string, any>
): Record<string, string> {
  const toObj = (h?: Headers | Record<string, any>): Record<string, string> => {
    if (!h) return {};
    if (h instanceof Headers) return Object.fromEntries(h.entries());
    return { ...h } as Record<string, string>;
  };
  return { ...toObj(a), ...toObj(b) };
}

function estimateSize(payload: unknown): number {
  try {
    return JSON.stringify(payload).length + 128; // + a little for headers/overhead
  } catch {
    return 512; // fallback
  }
}

/**
 * Batches and sends provider-level HTTP requests using the dispatcher’s
 * backoff/concurrency/bytes logic. This is **independent** of the facade-
 * level dispatcher that wraps provider API calls in closures.
 *
 * Providers can new-up this class and call `enqueue()` instead of using a raw transport.
 */
export class NetworkDispatcher {
  private transportP: Promise<Transport> | null = null;
  private batcher: EventBatchProcessor | null = null;
  private performanceTracker: PerformanceTracker | null = null;
  private readonly batchingEnabled: boolean;

  constructor(private readonly opts: NetworkDispatcherOptions) {
    this.opts = {
      batching: applyBatchingDefaults(opts.batching || {}),
      resilience: applyResilienceDefaults(opts.resilience || {}),
      defaultHeaders: opts.defaultHeaders || {},
    }
    this.performanceTracker = opts.performanceTracker || null;
    this.batchingEnabled = !!opts.batching?.enabled;
    if (this.batchingEnabled) {
      // Construct the batcher *now* so providers can enqueue immediately.
      this.batcher = new EventBatchProcessor(
        // Pass *only* the knobs EventBatchProcessor actually supports
        {
          maxSize: this.opts.batching?.maxSize,
          maxWait: this.opts.batching?.maxWait,
          maxBytes: this.opts.batching?.maxBytes,
          concurrency: this.opts.batching?.concurrency,
          deduplication: this.opts.batching?.deduplication,
          retry: this.opts.batching?.retry,
        },
        (batch) => this.sendBatch(batch.events)
      );
    }
  }

  /** For tests: inject a specific transport. */
  _setTransportForTests(t: Transport) {
    this.transportP = Promise.resolve(t);
  }

  private async getTransport(): Promise<Transport> {
    if (!this.transportP) {
      const maybe = resolveTransport(this.opts.resilience);
      this.transportP = Promise.resolve(maybe);
    }
    return this.transportP;
  }

  /**
   * Public API for providers/adapters to queue network requests.
   * If batching is disabled, this sends immediately via the selected transport.
   */
  async send(payload: DispatchPayload): Promise<void> {
    if (!this.batchingEnabled || !this.batcher) {
      // immediate send path
      const t = await this.getTransport();
      const headers = mergeHeaders(this.opts.defaultHeaders, payload.init?.headers);
      const finalPayload = { ...payload, init: { ...(payload.init || {}), headers } };

      const sendFn = () => t.send(finalPayload);

      if (this.performanceTracker) {
        await this.performanceTracker.trackNetworkRequest('network-send', sendFn);
      } else {
        await sendFn();
      }

      return;
    }

    this.batcher.add({
      id: String(Date.now()) + Math.random().toString(36).slice(2),
      timestamp: Date.now(),
      size: estimateSize(payload),
      payload,
    });
  }

  async flush(): Promise<void> {
    await this.batcher?.flush();
  }

  destroy(): void {
    this.batcher?.destroy();
  }

  /**
   * Invoked by EventBatchProcessor when a batch is ready.
   * We *do not* coalesce to one POST – different endpoints/headers may exist.
   * Instead, send each payload with backoff controlled by the batcher’s retry config.
   */
  private async sendBatch(
    events: Array<{
      id: string;
      payload: DispatchPayload;
    }>
  ): Promise<void> {
    const t = await this.getTransport();

    // Send sequentially to preserve order within the batch; the batcher controls overall concurrency.
    for (const e of events) {
      const headers = mergeHeaders(this.opts.defaultHeaders, e.payload.init?.headers);
      const finalPayload = { ...e.payload, init: { ...(e.payload.init || {}), headers } };
      const sendFn = () => t.send(finalPayload);

      if (this.performanceTracker) {
        await this.performanceTracker.trackNetworkRequest('network-batch-send', sendFn);
      } else {
        await sendFn();
      }
    }
  }
}
