import { ConsentCategory } from '../consent/types';
import { DEFAULT_CATEGORY } from '../constants';
import { PageContext } from '../types';
import { EventQueue } from './runtime';
import { SSRQueue } from './ssr';
import type { IQueue, QueueConfig, QueuedEventUnion } from './types';

export class QueueService {
  private runtime: EventQueue;
  private ssr: IQueue;

  constructor(cfg: QueueConfig) {
    this.runtime = new EventQueue(cfg);
    this.ssr = new SSRQueue();
  }

  reconfigure(cfg: QueueConfig) {
    this.runtime.reconfigure(cfg);
  }

  // runtime-only enqueue; SSR enqueue is handled on the server side with enqueueSSREvent()
  enqueue(
    type: QueuedEventUnion['type'],
    args: Extract<QueuedEventUnion, { type: typeof type }>['args'],
    category: ConsentCategory = DEFAULT_CATEGORY,
    pageContext?: PageContext
  ) { return this.runtime.enqueue(type, args, category, pageContext); }

  // Unified operations
  flushAll(): QueuedEventUnion[] { return [...this.ssr.flush(), ...this.runtime.flush()]; }

  /**
   * Drain only 'essential' across SSR + runtime queues.
   * Non-essentials remain enqueued in both queues.
   */
  flushEssential(): QueuedEventUnion[] { return [...this.ssr.flushEssential(), ...this.runtime.flushEssential()]; }

  /** Drop *everything* without materializing; returns how many were dropped. */
  clearAll(): number { return this.ssr.clear() + this.runtime.clear(); }

  /** Drop only non-essential across both queues. */
  clearNonEssential(): number { return this.ssr.clearNonEssential() + this.runtime.clearNonEssential(); }

  size(): number { return this.runtime.size + this.ssr.size; }
  capacity(): number { return this.runtime.getCapacity(); }

  getOverflowHandler() { return this.runtime.getOverflowHandler(); }
}
