import { EventBatchProcessor, type BatchConfig } from './batch-processor';
import { PerformanceTracker } from '../performance/tracker';

export type DispatchItem = {
  id: string;
  type: 'track' | 'pageview' | 'identify';
  run: () => Promise<void> | void; // provider call closure
  size?: number;                   // optional estimate
};

export type DispatcherConfig = {
  batching?: (BatchConfig & { enabled: boolean }) | undefined;
  performance?: { enabled?: boolean; sampleRate?: number } | undefined;
};

export class Dispatcher {
  private batch?: EventBatchProcessor;
  private perf?: PerformanceTracker;

  constructor(cfg: DispatcherConfig) {
    if (cfg.performance?.enabled) this.perf = new PerformanceTracker();
    if (cfg.batching?.enabled) {
      this.batch = new EventBatchProcessor(cfg.batching, (batch) =>
        this.sendBatch(batch.events)
      );
    }
  }

  enqueue(item: DispatchItem) {
    if (!this.batch) return this.run(item);
    this.batch.add({
      id: item.id,
      timestamp: Date.now(),
      type: item.type,
      payload: { run: item.run },
      size: item.size ?? 100
    });
    return Promise.resolve();
  }

  async flush() { await this.batch?.flush(); }

  destroy() { this.batch?.destroy(); }

  private async sendBatch(events: { id: string; payload: { run: () => Promise<void> | void } }[]) {
    for (const e of events) {
      await this.run({ id: e.id, type: 'track', run: e.payload.run });
    }
  }

  private run(item: DispatchItem) {
    if (!this.perf) return Promise.resolve(item.run());
    return this.perf.trackNetworkRequest(item.type, async () => { await item.run(); });
  }
}