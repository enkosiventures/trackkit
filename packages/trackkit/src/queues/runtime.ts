import { ConsentCategory } from '../consent/types';
import { DEFAULT_CATEGORY } from '../constants';
import { PageContext } from '../types';
import { deepClone } from '../util';
import { logger } from '../util/logger';
import type { IQueue, QueueConfig, QueuedEvent, QueuedEventUnion } from './types';


/**
 * Generate unique event ID
 */
let eventCounter = 0;
function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

export class EventQueue implements IQueue {
  private queue: QueuedEventUnion[] = [];
  private config: QueueConfig;
  private isPaused = false;

  constructor(config: QueueConfig) {
    this.config = config;
    logger.debug('EventQueue initialized', { maxSize: config.maxSize });
  }

  /**
   * Add event to queue
   */
  enqueue(
    type: QueuedEventUnion['type'],
    args: Extract<QueuedEventUnion, { type: typeof type }>['args'],
    category: ConsentCategory = DEFAULT_CATEGORY,
    pageContext?: PageContext
  ): string | undefined {
    if (this.isPaused) {
      logger.debug('Queue is paused, dropping event', { type });
      return undefined;
    }

    const event: QueuedEvent = {
      id: generateEventId(),
      type,
      timestamp: Date.now(),
      args: deepClone(args),
      category,
      pageContext: pageContext ? deepClone(pageContext) : undefined,
    };

    // Check for overflow
    logger.debug('Enqueuing event', {
      event,
      maxSize: this.config.maxSize,
      queueLength: this.queue.length,
    });
    if (this.queue.length >= this.config.maxSize) {
      logger.debug('[OVERFLOW] Queue overflow detected');
      const dropped = this.queue.splice(0, this.queue.length - this.config.maxSize + 1);
      
      logger.warn(`Queue overflow, dropping ${dropped.length} oldest events`);
      
      if (this.config.onOverflow) {
        this.config.onOverflow(dropped);
      }
    }
    
    this.queue.push(event as QueuedEventUnion);
    
    logger.debug('Event queued', {
      id: event.id,
      type: event.type,
      queueSize: this.queue.length,
    });
    
    return event.id;
  }

  /**
   * Reconfigure the event queue
   */
  reconfigure(newConfig: Partial<QueueConfig>) {
    const prev = this.config;
    this.config = { ...prev, ...newConfig };

    // If maxSize shrank, drop oldest to fit and notify
    if (this.queue.length > this.config.maxSize) {
      const dropCount = this.queue.length - this.config.maxSize;
      const dropped = this.queue.splice(0, dropCount);
      this.config.onOverflow?.(dropped);
      logger.debug('Queue trimmed on reconfigure', { dropCount, newMax: this.config.maxSize });
    }

    logger.debug('Queue reconfigured', {
      newMaxSize: this.config.maxSize,
      debug: this.config.debug,
      size: this.queue.length,
    });
  }

  /**
   * Remove and return all queued events
   */
  flush(): QueuedEventUnion[] {
    const events = [...this.queue];
    this.queue = [];
    
    logger.debug('Queue flushed', { 
      eventCount: events.length,
      oldestEvent: events[0]?.timestamp,
      newestEvent: events[events.length - 1]?.timestamp,
    });

    return events;
  }

  /** Drain only 'essential' items; keep non-essentials enqueued. */
  flushEssential(): QueuedEventUnion[] {
    if (!this.queue.length) return [];
    const essentials: QueuedEventUnion[] = [];
    const keep: QueuedEventUnion[] = [];
    for (const ev of this.queue) {
      if (ev?.category === 'essential') essentials.push(ev);
      else keep.push(ev);
    }
    this.queue = keep;
    return essentials;
  }

  /**
   * Remove specific events by predicate
   */
  remove(predicate: (event: QueuedEventUnion) => boolean): QueuedEventUnion[] {
    const removed: QueuedEventUnion[] = [];
    this.queue = this.queue.filter(event => {
      if (predicate(event)) {
        removed.push(event);
        return false;
      }
      return true;
    });
    
    if (removed.length > 0) {
      logger.debug('Events removed from queue', { count: removed.length });
    }
    
    return removed;
  }
  
  /**
   * Clear all events
   */
  clear(): number {
    const count = this.queue.length;
    this.queue = [];
    logger.debug('Queue cleared', { eventsDropped: count });
    return count;
  }

  /** Drop only non-essential items; returns how many dropped. */
  clearNonEssential(): number {
    if (!this.queue.length) return 0;
    let dropped = 0;
    const keep: QueuedEventUnion[] = [];
    for (const ev of this.queue) {
      if (ev?.category === 'essential') keep.push(ev);
      else dropped++;
    }
    this.queue = keep;
    return dropped;
  }
  
  /**
   * Pause queue (for consent denied state)
   */
  pause(): void {
    this.isPaused = true;
    logger.debug('Queue paused');
  }
  
  /**
   * Resume queue
   */
  resume(): void {
    this.isPaused = false;
    logger.debug('Queue resumed');
  }
  
  /**
   * Get queue state
   */
  getState() {
    return {
      size: this.queue.length,
      isPaused: this.isPaused,
      oldestEventAge: this.queue[0] 
        ? Date.now() - this.queue[0].timestamp 
        : null,
    };
  }
  
  /**
   * Get a copy of all queued events (for debugging)
   */
  getEvents(): ReadonlyArray<Readonly<QueuedEventUnion>> {
    return [...this.queue];
  }
  
  getCapacity(): number {
    return this.config.maxSize;
  }

  getOverflowHandler(): ((dropped: QueuedEventUnion[]) => void) | undefined {
    return this.config.onOverflow;
  }

  get size(): number {
    return this.queue.length;
  }
  
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }
}
