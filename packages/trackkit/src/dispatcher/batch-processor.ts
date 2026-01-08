import { getId } from '../util';
import { logger } from '../util/logger';
import type { Batch, BatchedEvent, DispatchPayload, ResolvedBatchingOptions } from './types';


export interface BatchProcessorOptions {
  batching: ResolvedBatchingOptions;
  sendFn: (batch: Batch) => Promise<void>;
  onAdd?: (event: BatchedEvent, current: Batch) => void;
}

function getBodySize(payload: DispatchPayload): number {
  try { return new Blob([JSON.stringify(payload.body)]).size; }
  catch { return JSON.stringify(payload.body).length * 2; }
}

export class EventBatchProcessor {
  private current: Batch | null = null;
  private sendTimer: ReturnType<typeof setTimeout> | null = null;
  private running = 0;                        // number of batches currently sending
  private waiters: Array<() => void> = [];    // queued resolvers waiting for a slot
  private inflight = new Set<Promise<void>>();// all active send promises
  private dedupe = new Set<string>();

  constructor(private readonly options: BatchProcessorOptions) {}

  add(event: BatchedEvent) {
    const { batching, onAdd } = this.options;
    if (batching.deduplication && this.dedupe.has(event.id)) return;

    const size = event.size || getBodySize(event.payload);
    if (!this.current) this.current = this.createBatch();

    // Case A: normal split (current already has items and adding would overflow)
    if (this.shouldSplit(this.current, size)) {
      logger.debug(`Splitting batch: ${this.current.id}, sending events: `, this.current.events);
      this.sendBatch(this.current);
      this.current = this.createBatch();
    }

    // Push the event into current
    logger.debug(`Adding event to current batch: ${this.current.id}`, event);
    this.current.events.push(event);
    this.current.totalSize += size;
    onAdd?.(event, this.current);

    // Case B: single-event bigger than maxBytes — send immediately as its own batch
    if (size > batching.maxBytes && this.current.events.length === 1) {
      logger.debug(`Single event exceeds maxBytes, sending immediately: ${this.current.id}`, this.current);
      const single = this.current;
      this.current = null;
      this.sendBatch(single);
    }

    if (batching.deduplication) {
      this.dedupe.add(event.id);
      if (this.dedupe.size > 1000) {
        this.dedupe = new Set(Array.from(this.dedupe).slice(-500));
      }
    }

    if (!this.sendTimer) {
      this.sendTimer = setTimeout(() => {
        this.sendTimer = null;
        if (this.current && this.current.events.length) {
          logger.debug(`Max wait reached, sending batch: ${this.current.id}`, this.current);
          this.sendBatch(this.current);
          this.current = null;
        }
      }, batching.maxWait);
    }
  }

  async flush() {
    // cancel scheduled auto-flush
    if (this.sendTimer) { clearTimeout(this.sendTimer); this.sendTimer = null; }
    // kick any pending current batch into flight
    if (this.current && this.current.events.length) {
      logger.debug('Flushing current batch:', this.current.id);
      const batch = this.current;
      this.current = null;
      // do not await here; inflight tracking will make flush deterministic
      void this.sendBatch(batch);
    }
    // deterministically wait for all in-flight sends (including retries)
    if (this.inflight.size) {
      await Promise.all([...this.inflight]);
    }
  }

  destroy() {
    if (this.sendTimer) clearTimeout(this.sendTimer);
    this.current = null;
    this.waiters.length = 0;
    this.inflight.clear();
    this.running = 0;
    this.dedupe.clear();
  }

  private createBatch(): Batch {
    return {
      id: `batch_${getId()}`,
      events: [],
      totalSize: 0,
      createdAt: Date.now(),
      attempts: 0,
      status: 'pending'
    };
  }

  private shouldSplit(batch: Batch, nextSize: number) {
    const { batching } = this.options;
    // return batch.events.length >= this.batching.maxSize || (batch.totalSize + nextSize) > this.batching.maxBytes;
    const byCount = batch.events.length >= batching.maxSize;
    // <— only consider bytes overflow when there is at least 1 event in the batch
    const byBytes = batch.events.length > 0 && (batch.totalSize + nextSize) > batching.maxBytes;
    return byCount || byBytes;
  }

  private async acquireSlot() {
    if (this.running < this.options.batching.concurrency) {
      this.running++;
      return;
    }
    await new Promise<void>(resolve => {
      // We push a closure that increments running when given the slot
      this.waiters.push(() => { this.running++; resolve(); });
    });
  }

  private releaseSlot() {
    const next = this.waiters.shift();
    if (next) {
      // Hand over slot directly to the next waiter
      next();
    } else {
      this.running = Math.max(0, this.running - 1);
    }
  }

  private sendBatch(batch: Batch): Promise<void> {
    const p = (async () => {
      await this.acquireSlot();
      batch.status = 'sending';
      batch.attempts++;
      try {
        logger.debug(`Sending batch: ${batch.id}, events:`, batch.events.map(e => e.id));
        await this.options.sendFn(batch);
        batch.status = 'sent';
      } catch (error) {
        batch.status = 'failed';
        batch.lastError = error;
      } finally {
        this.releaseSlot();
      }
    })();
    // Track promise deterministically for flush()
    this.inflight.add(p);
    p.finally(() => this.inflight.delete(p)).catch(() => { /* errors handled above */ });
    return p;
  }
}