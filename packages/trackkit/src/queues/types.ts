import type { ConsentCategory } from '../consent/types';
import type { EventType, PageContext, Props } from '../types';

export type Essentiality = 'essential' | 'non-essential';

// export type PageviewEvent = { kind: 'pageview'; url: string; ctx?: unknown; essential?: boolean };
// export type TrackEvent    = { kind: 'track';   name: string; props?: Record<string, unknown>; ctx?: unknown; essential?: boolean };
// export type IdentifyEvent = { kind: 'identify'; userId: string | null; ctx?: unknown; essential?: boolean };

// export type QueuedEventUnion = PageviewEvent | TrackEvent | IdentifyEvent;

/**
 * Queued event structure
 */
export interface QueuedEvent {
  id: string;
  type: EventType;
  timestamp: number;
  args: unknown[];
  category: ConsentCategory;
  pageContext?: PageContext;
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
 * Union of all queued event types
 */
export type QueuedEventUnion = 
  | QueuedTrackEvent 
  | QueuedPageviewEvent 
  | QueuedIdentifyEvent; 

/**
 * Event queue configuration
 */
export interface QueueConfig {
  maxSize: number;
  onOverflow?: (dropped: QueuedEventUnion[]) => void;
  debug?: boolean;
}

export interface IQueue {
  // Enqueue is intentionally optional so SSR wrapper can omit it on client
  enqueue?(
    type: QueuedEventUnion['type'],
    args: Extract<QueuedEventUnion, { type: typeof type }>['args'],
    category: ConsentCategory,
    pageContext?: PageContext
  ): string | undefined;
  flush(): QueuedEventUnion[];                // flush all
  flushEssential(): QueuedEventUnion[];       // flush only essential
  clear(): number;             // clear all, return count
  clearNonEssential(): number; // clear non-essential only, return count
  readonly size: number;
  getCapacity?(): number;      // only meaningful for runtime queue
}
