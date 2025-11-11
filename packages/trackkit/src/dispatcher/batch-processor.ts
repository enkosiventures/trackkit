import { applyBatchingDefaults } from '../facade/normalize';
import { RetryManager } from './retry';
import { logger } from '../util/logger';
import type { Batch, BatchConfig, BatchedEvent, DispatchPayload } from './types';


function getBodySize(payload: DispatchPayload): number {
  try { return new Blob([JSON.stringify(payload.body)]).size; }
  catch { return JSON.stringify(payload.body).length * 2; }
}

export class EventBatchProcessor {
  private cfg: Required<BatchConfig>;
  private current: Batch | null = null;
  private sendTimer: ReturnType<typeof setTimeout> | null = null;
  private running = 0;                        // number of batches currently sending
  private waiters: Array<() => void> = [];    // queued resolvers waiting for a slot
  private inflight = new Set<Promise<void>>();// all active send promises
  private dedupe = new Set<string>();
  private retry: RetryManager;

  constructor(config: BatchConfig, private sendFn: (batch: Batch) => Promise<void>) {
    this.cfg = applyBatchingDefaults(config);
    // @ts-expect-error: cfg.retry is now required
    this.retry = new RetryManager(this.cfg.retry);
  }

  add(event: BatchedEvent) {
    if (this.cfg.deduplication && this.dedupe.has(event.id)) return;

    const size = event.size || getBodySize(event.payload);
    if (!this.current) this.current = this.createBatch();

    // Case A: normal split (current already has items and adding would overflow)
    if (this.shouldSplit(this.current, size)) {
      logger.debug(`Splitting batch: ${this.current.id}`, this.current.events);
      this.sendBatch(this.current);
      this.current = this.createBatch();
    }

    // Push the event into current
    logger.debug(`Adding event to current batch: ${this.current.id}`, event);
    this.current.events.push(event);
    this.current.totalSize += size;

    // Case B: single-event bigger than maxBytes — send immediately as its own batch
    if (size > this.cfg.maxBytes && this.current.events.length === 1) {
      logger.debug(`Single event exceeds maxBytes, sending immediately: ${this.current.id}`, this.current);
      const single = this.current;
      this.current = null;
      this.sendBatch(single);
    }

    if (this.cfg.deduplication) {
      this.dedupe.add(event.id);
      if (this.dedupe.size > 1000) {
        this.dedupe = new Set(Array.from(this.dedupe).slice(-500));
      }
    }

    if (!this.sendTimer) {
      this.sendTimer = setTimeout(() => {
        this.sendTimer = null;
        if (this.current && this.current.events.length) {
          this.sendBatch(this.current);
          this.current = null;
        }
      }, this.cfg.maxWait);
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
    this.retry.cancelAll();
    this.current = null;
    this.waiters.length = 0;
    this.inflight.clear();
    this.running = 0;
    this.dedupe.clear();
  }

  private createBatch(): Batch {
    return { id: `batch_${Math.random().toString(36).slice(2)}`, events: [], totalSize: 0, createdAt: Date.now(), attempts: 0, status: 'pending' };
  }

  private shouldSplit(batch: Batch, nextSize: number) {
    // return batch.events.length >= this.cfg.maxSize || (batch.totalSize + nextSize) > this.cfg.maxBytes;
    const byCount = batch.events.length >= this.cfg.maxSize;
    // <— only consider bytes overflow when there is at least 1 event in the batch
    const byBytes = batch.events.length > 0 && (batch.totalSize + nextSize) > this.cfg.maxBytes;
    return byCount || byBytes;
  }

  private async acquireSlot() {
    if (this.running < this.cfg.concurrency) {
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
        await this.sendFn(batch);
        batch.status = 'sent';
      } catch {
        batch.status = 'failed';
        if (batch.attempts < this.cfg.retry.maxAttempts!) {
          // Schedule a retry; it will create its own tracked promise via sendBatch
          this.retry.scheduleRetry(batch.id, () => this.sendBatch(batch), batch.attempts);
        }
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