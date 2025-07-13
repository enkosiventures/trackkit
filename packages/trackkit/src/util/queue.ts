import type { Props, ConsentState } from '../types';
import { AnalyticsError } from '../errors';
import { logger } from './logger';

/**
 * Queued event types
 */
export type EventType = 'track' | 'pageview' | 'identify' | 'setConsent';

/**
 * Queued event structure
 */
export interface QueuedEvent {
  id: string;
  type: EventType;
  timestamp: number;
  args: unknown[];
}

/**
 * Track event in queue
 */
export interface QueuedTrackEvent extends QueuedEvent {
  type: 'track';
  args: [name: string, props?: Props, url?: string];
}

/**
 * Pageview event in queue
 */
export interface QueuedPageviewEvent extends QueuedEvent {
  type: 'pageview';
  args: [url?: string];
}

/**
 * Identify event in queue
 */
export interface QueuedIdentifyEvent extends QueuedEvent {
  type: 'identify';
  args: [userId: string | null];
}

/**
 * Consent event in queue
 */
export interface QueuedConsentEvent extends QueuedEvent {
  type: 'setConsent';
  args: [state: ConsentState];
}

/**
 * Union of all queued event types
 */
export type QueuedEventUnion = 
  | QueuedTrackEvent 
  | QueuedPageviewEvent 
  | QueuedIdentifyEvent 
  | QueuedConsentEvent;

/**
 * Event queue configuration
 */
export interface QueueConfig {
  maxSize: number;
  onOverflow?: (dropped: QueuedEvent[]) => void;
  debug?: boolean;
}

/**
 * Generate unique event ID
 */
let eventCounter = 0;
function generateEventId(): string {
  return `evt_${Date.now()}_${++eventCounter}`;
}

/**
 * In-memory event queue with overflow protection
 */
export class EventQueue {
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
  enqueue<T extends EventType>(
    type: T,
    args: QueuedEventUnion['args']
  ): string {
    if (this.isPaused) {
      logger.debug('Queue is paused, dropping event', { type });
      return '';
    }
    
    const event: QueuedEvent = {
      id: generateEventId(),
      type,
      timestamp: Date.now(),
      args,
    };
    
    // Check for overflow
    if (this.queue.length >= this.config.maxSize) {
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
  clear(): void {
    const count = this.queue.length;
    this.queue = [];
    logger.debug('Queue cleared', { eventsDropped: count });
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
  
  get size(): number {
    return this.queue.length;
  }
  
  get isEmpty(): boolean {
    return this.queue.length === 0;
  }
}