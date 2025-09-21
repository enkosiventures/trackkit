import { EventQueue, QueuedEventUnion } from '../util/queue';
import { getSSRQueueLength, flushSSRAll, flushSSREssential, clearSSRAll, clearSSRNonEssential } from '../util/ssr-queue';
import type { FacadeOptions, EventType, PageContext } from '../types';


export class QueueService {
  private facadeQueue: EventQueue;
  constructor(cfg: FacadeOptions, onOverflow: (dropped: QueuedEventUnion[]) => void) {
    this.facadeQueue = new EventQueue({ maxSize: cfg?.queueSize ?? 50, debug: !!cfg?.debug, onOverflow });
  }
  reconfigure(cfg: FacadeOptions) {
    this.facadeQueue.reconfigure({ maxSize: cfg?.queueSize ?? 50, debug: !!cfg?.debug, onOverflow: this.facadeQueue.getOverflowHandler() });
  }
  enqueue<T extends EventType>(type: T, args: Extract<QueuedEventUnion, { type: T }>['args'], category: string, pageContext?: PageContext) {
    // @ts-expect-error: allow dynamic args
    return this.facadeQueue.enqueue(type, args, category, pageContext);
  }

  // -- low-level accessors --
  flushSSR(): QueuedEventUnion[] { return flushSSRAll(); }
  flushFacade(): QueuedEventUnion[] { return this.facadeQueue.flush(); }

  // -- combined operations --
  flushAll(): QueuedEventUnion[] {
    const ssr = this.flushSSR();
    const fac = this.flushFacade();
    return [...ssr, ...fac];
  }

  /**
   * Drain only 'essential' across SSR + runtime queues.
   * Non-essentials remain enqueued in both queues.
   */
  flushEssential(): QueuedEventUnion[] {
    const ssrEss = flushSSREssential();
    const facEss = this.facadeQueue.flushEssential();
    return [...ssrEss, ...facEss];
  }

  /** Drop *everything* without materializing; returns how many were dropped. */
  clearAll(): number {
    const droppedSSR = clearSSRAll();
    const droppedFac = this.facadeQueue.clear();
    return droppedSSR + droppedFac;
  }

  /** Drop only non-essential across both queues. */
  clearNonEssential(): number {
    const droppedSSR = clearSSRNonEssential();
    const droppedFac = this.facadeQueue.clearNonEssential();
    return droppedSSR + droppedFac;
  }

  /** Keep if you still have callsites that clear just the runtime queue */
  clearFacade(): number {
    return this.facadeQueue.clear();
  }

  size(): number { return this.facadeQueue.size + getSSRQueueLength(); }
  capacity(): number { return this.facadeQueue.getCapacity(); }
}