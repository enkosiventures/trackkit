import { EventQueue, QueuedEventUnion } from '../util/queue';
import { hydrateSSRQueue, getSSRQueue, getSSRQueueLength, isSSR } from '../util/ssr-queue';
import type { FacadeOptions, EventType } from '../types';
import { logger } from '../util/logger';



export class QueueService {
  private facadeQueue: EventQueue;
  constructor(cfg: FacadeOptions, onOverflow: (dropped: QueuedEventUnion[]) => void) {
    this.facadeQueue = new EventQueue({ maxSize: cfg?.queueSize ?? 50, debug: !!cfg?.debug, onOverflow });
  }
  reconfigure(cfg: FacadeOptions) {
    this.facadeQueue.reconfigure({ maxSize: cfg?.queueSize ?? 50, debug: !!cfg?.debug, onOverflow: this.facadeQueue.getOverflowHandler() });
  }
  enqueue<T extends EventType>(type: T, args: Extract<QueuedEventUnion, { type: T }>['args'], category: string, pageContext: any) {
    // @ts-expect-error
    return this.facadeQueue.enqueue(type, args, category, pageContext);
  }
  flushSSR(): QueuedEventUnion[] { return isSSR() ? [] : hydrateSSRQueue(); }
  flushFacade(): QueuedEventUnion[] { return this.facadeQueue.flush(); }
  clearFacade() { this.facadeQueue.clear(); }
  clearAll() { this.clearFacade(); if (!isSSR()) hydrateSSRQueue(); }
  size() { return this.facadeQueue.size + getSSRQueueLength(); }
  capacity() { return this.facadeQueue.getCapacity(); }
}