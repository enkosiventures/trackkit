import { DEFAULT_HEADERS } from '../constants';
import { applyBatchingDefaults, applyResilienceDefaults } from '../facade/normalize';
import type { PerformanceTracker } from '../performance/tracker';
import { stripEmptyFields } from '../util';
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
  private transportPromise: Promise<Transport> | null = null;
  private batcher: EventBatchProcessor | null = null;
  private performanceTracker: PerformanceTracker | null = null;
  private readonly batchingEnabled: boolean;

  constructor(private readonly options: NetworkDispatcherOptions) {
    this.options = {
      batching: applyBatchingDefaults(options.batching || {}),
      resilience: applyResilienceDefaults(options.resilience || {}),
      defaultHeaders: options.defaultHeaders || DEFAULT_HEADERS,
      bustCache: options.bustCache || false,
    }
    this.performanceTracker = options.performanceTracker || null;
    this.batchingEnabled = !!options.batching.enabled;
    if (this.batchingEnabled) {
      // Construct the batcher now so providers can enqueue immediately.
      this.batcher = new EventBatchProcessor(
        this.options.batching,
        this.options.resilience.retry,
        (batch) => this.sendBatch(batch.events)
      );
    }
  }

  /** For tests: inject a specific transport. */
  _setTransportForTests(t: Transport) {
    this.transportPromise = Promise.resolve(t);
  }

  private async getTransport(): Promise<Transport> {
    if (!this.transportPromise) {
      const maybe = resolveTransport(this.options.resilience);
      this.transportPromise = Promise.resolve(maybe);
    }
    return this.transportPromise;
  }

  private appendCacheParam(url: string): string {
    // Robust even for absolute URLs; falls back to string concat if URL ctor fails.
    try {
      const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
      const u = new URL(url, base);
      u.searchParams.set('cache', String(Date.now()));
      return u.toString().replace(/^https?:\/\/[^/]+/, ''); // keep as path if same-origin
    } catch {
      const sep = url.includes('?') ? '&' : '?';
      return `${url}${sep}cache=${Date.now()}`;
    }
  }

  private processBody(body: unknown, method?: string): string | undefined {
    if (method === 'GET') return undefined;
    if (!body) return '';
    if (typeof body === 'string') return body;
    
    const stripped = stripEmptyFields(body);
    return JSON.stringify(stripped);
  }

  private prepareFinalPayload(payload: DispatchPayload, bustCache?: boolean): DispatchPayload {
    let finalUrl = payload.url;
    const headers = mergeHeaders(this.options.defaultHeaders, payload.init?.headers);
    
    // Cache busting logic
    if (bustCache) {
      const method = payload.init?.method || 'POST';
      if (method === 'GET' || method === 'BEACON') {
        finalUrl = this.appendCacheParam(finalUrl);
      } else {
        Object.assign(headers, {
          'Cache-Control': 'no-store, max-age=0',
          'Pragma': 'no-cache'
        });
      }
    }

    // Ensure content-type
    if (!headers['content-type'] && payload.body) {
      headers['content-type'] = 'application/json';
    }

    return {
      ...payload,
      url: finalUrl,
      init: {
        ...payload.init,
        headers,
        body: this.processBody(payload.body, payload.init?.method)
      }
    };
  }

  /**
   * Public API for providers/adapters to queue network requests.
   * If batching is disabled, this sends immediately via the selected transport.
   */
  async send(payload: DispatchPayload): Promise<void> {
    if (!this.batchingEnabled || !this.batcher) {
      // immediate send path
      const transport = await this.getTransport();
      const headers = mergeHeaders(this.options.defaultHeaders, payload.init?.headers);
      const finalPayload = this.prepareFinalPayload({ ...payload, init: { ...(payload.init || {}), headers }});

      const sendFn = () => transport.send(finalPayload);

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
      const headers = mergeHeaders(this.options.defaultHeaders, e.payload.init?.headers);
      const finalPayload = this.prepareFinalPayload({ ...e.payload, init: { ...(e.payload.init || {}), headers }});
      const sendFn = () => t.send(finalPayload);

      if (this.performanceTracker) {
        await this.performanceTracker.trackNetworkRequest('network-batch-send', sendFn);
      } else {
        await sendFn();
      }
    }
  }
}
