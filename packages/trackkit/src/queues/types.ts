// import type { ConsentCategory } from '../consent/types';
// import type { EventType, PageContext, Props } from '../types';

// export type Essentiality = 'essential' | 'non-essential';

// /**
//  * Queued event structure
//  */
// export interface QueuedEvent {
//   id: string;
//   type: EventType;
//   timestamp: number;
//   args: unknown[];
//   category: ConsentCategory;
//   pageContext?: PageContext;
// }

// /**
//  * Track event in queue
//  */
// export interface QueuedTrackEvent extends QueuedEvent {
//   type: 'track';
//   args: [name: string, props?: Props, url?: string];
// }

// /**
//  * Pageview event in queue
//  */
// export interface QueuedPageviewEvent extends QueuedEvent {
//   type: 'pageview';
//   args: [url?: string];
// }

// /**
//  * Identify event in queue
//  */
// export interface QueuedIdentifyEvent extends QueuedEvent {
//   type: 'identify';
//   args: [userId: string | null];
// }

// /**
//  * Union of all queued event types
//  */
// export type QueuedEventUnion = 
//   | QueuedTrackEvent 
//   | QueuedPageviewEvent 
//   | QueuedIdentifyEvent; 

// /**
//  * Event queue configuration
//  */
// export interface QueueConfig {
//   maxSize: number;
//   onOverflow?: (dropped: QueuedEventUnion[]) => void;
//   debug?: boolean;
// }

// // Queue interface
// export interface IQueue {
//   // Enqueue is intentionally optional so SSR wrapper can omit it on client
//   enqueue?(
//     type: QueuedEventUnion['type'],
//     args: Extract<QueuedEventUnion, { type: typeof type }>['args'],
//     category: ConsentCategory,
//     pageContext?: PageContext
//   ): string | undefined;
//   flush(): QueuedEventUnion[];                // flush all
//   flushEssential(): QueuedEventUnion[];       // flush only essential
//   clear(): number;             // clear all, return count
//   clearNonEssential(): number; // clear non-essential only, return count
//   readonly size: number;
//   getCapacity?(): number;      // only meaningful for runtime queue
// }




import type { ConsentCategory } from '../consent/types';
import type { EventType, PageContext, Props } from '../types';

/**
 * Logical essentiality of an event with respect to consent.
 *
 * - `'essential'`     – can be emitted even when consent is denied (if
 *   policy allows).
 * - `'non-essential'` – subject to consent decisions.
 */
export type Essentiality = 'essential' | 'non-essential';

/**
 * Base queued event structure used by the facade’s in-memory queue.
 *
 * This captures enough information to re-dispatch the original facade
 * call once policy allows (e.g. after consent is granted).
 */
export interface QueuedEvent {
  /**
   * Unique identifier for this queued event.
   */
  id: string;

  /**
   * High-level event type (`'track'`, `'pageview'`, `'identify'`).
   */
  type: EventType;

  /**
   * Timestamp when the event was enqueued (ms since epoch).
   */
  timestamp: number;

  /**
   * Raw argument list for the facade method.
   *
   * The concrete shapes are specialised in the more specific
   * {@link QueuedTrackEvent}, {@link QueuedPageviewEvent} and
   * {@link QueuedIdentifyEvent} types.
   */
  args: unknown[];

  /**
   * Consent category this event belongs to.
   *
   * Used by the consent gate and `flushEssential`/`clearNonEssential`.
   */
  category: ConsentCategory;

  /**
   * Snapshot of the page context captured at enqueue time.
   *
   * May be omitted for some calls.
   */
  pageContext?: PageContext;
}

/**
 * Queued `track` event with precise argument typing.
 */
export interface QueuedTrackEvent extends QueuedEvent {
  type: 'track';
  args: [name: string, props?: Props, url?: string];
}

/**
 * Queued `pageview` event with precise argument typing.
 */
export interface QueuedPageviewEvent extends QueuedEvent {
  type: 'pageview';
  args: [url?: string];
}

/**
 * Queued `identify` event with precise argument typing.
 */
export interface QueuedIdentifyEvent extends QueuedEvent {
  type: 'identify';
  args: [userId: string | null];
}

/**
 * Union of all queued event variants.
 *
 * This is the core type used by queue implementations.
 */
export type QueuedEventUnion =
  | QueuedTrackEvent
  | QueuedPageviewEvent
  | QueuedIdentifyEvent;

/**
 * Configuration options for the runtime event queue.
 *
 * This queue sits between the facade and the provider manager, ensuring
 * events are not lost when:
 * - consent is pending,
 * - the provider is still initialising,
 * - or the page is briefly offline.
 */
export interface QueueConfig {
  /**
   * Maximum number of events to hold in the queue.
   *
   * When exceeded, older events are dropped first and optionally reported
   * via {@link QueueConfig.onOverflow}.
   */
  maxSize: number;

  /**
   * Callback invoked when events are dropped due to overflow.
   *
   * Receives the list of dropped events.
   */
  onOverflow?: (dropped: QueuedEventUnion[]) => void;

  /**
   * Enable debug logging from the queue implementation.
   */
  debug?: boolean;
}

/**
 * Interface for the facade’s event queue implementation.
 *
 * This is intentionally minimal; it allows for:
 * - a no-op SSR implementation,
 * - an in-memory runtime queue,
 * - or more sophisticated queues if needed.
 *
 * @internal
 */
export interface IQueue {
  /**
   * Enqueue a new event.
   *
   * This is intentionally optional so an SSR-only implementation can omit
   * it on the server and only wire it up on the client.
   *
   * @param type       - Event type (`'track'`, `'pageview'`, `'identify'`).
   * @param args       - Argument tuple for the event type.
   * @param category   - Consent category for the event.
   * @param pageContext - Optional page context snapshot.
   * @returns A unique event ID, or `undefined` if enqueue is not supported.
   */
  enqueue?(
    type: QueuedEventUnion['type'],
    args: Extract<QueuedEventUnion, { type: typeof type }>['args'],
    category: ConsentCategory,
    pageContext?: PageContext,
  ): string | undefined;

  /**
   * Flush all events from the queue, regardless of category.
   *
   * Returns the flushed events in FIFO order.
   */
  flush(): QueuedEventUnion[];

  /**
   * Flush only events that are considered essential.
   *
   * Returns the flushed events.
   */
  flushEssential(): QueuedEventUnion[];

  /**
   * Clear all events from the queue.
   *
   * @returns Number of events removed.
   */
  clear(): number;

  /**
   * Clear only non-essential events from the queue.
   *
   * @returns Number of events removed.
   */
  clearNonEssential(): number;

  /**
   * Current number of events held in the queue.
   */
  readonly size: number;

  /**
   * Maximum queue capacity, if the implementation exposes it.
   */
  getCapacity?(): number;
}
