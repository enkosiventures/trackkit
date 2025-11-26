import type { ConsentCategory } from '../consent/types';
import type { EventType, PageContext } from '../types';
import { hasDOM, isClient, isServer } from '../util/env';
import type { IQueue, QueuedEventUnion } from './types';

/**
 * Global queue for SSR environments
 */
declare global {
  var __TRACKKIT_SSR_QUEUE__: QueuedEventUnion[] | undefined;
}

/** Return a direct reference if present (browser); on server it may be created already elsewhere. */
function getSSRQueueRef(): QueuedEventUnion[] | undefined {
  return globalThis.__TRACKKIT_SSR_QUEUE__;
}

/** Replace the SSR queue with the provided array, or clear it. */
function setSSRQueueRef(next?: QueuedEventUnion[]) {
  if (next && next.length) {
    globalThis.__TRACKKIT_SSR_QUEUE__ = next;
  } else {
    globalThis.__TRACKKIT_SSR_QUEUE__ = undefined;
  }
}

// server-only enqueue
export function enqueueSSREvent(
  type: EventType,
  args: unknown[],
  category: ConsentCategory,
  pageContext?: PageContext,
) {
  if (isClient() && type !== 'identify') return;

  // works on server (global), harmless on client (rarely used there)
  if (!globalThis.__TRACKKIT_SSR_QUEUE__) {
    globalThis.__TRACKKIT_SSR_QUEUE__ = [];
  }

  globalThis.__TRACKKIT_SSR_QUEUE__.push({
    id: `ssr_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    type,
    timestamp: Date.now(),
    // @ts-ignore allow dynamic
    args,
    category,
    pageContext,
  });
}

/**
 * Get or create SSR queue
 */
export function getSSRQueue(): QueuedEventUnion[] {
  if (isServer()) {
    if (!globalThis.__TRACKKIT_SSR_QUEUE__) {
      globalThis.__TRACKKIT_SSR_QUEUE__ = [];
    }
  }
  // Client: may be undefined until server serialized it (or after hydration clears it)
  return globalThis.__TRACKKIT_SSR_QUEUE__ ?? [];
}

export function getSSRQueueLength(): number {
  return getSSRQueue().length;
}


/** Drain everything from the SSR queue (what `hydrateSSRQueue` used to do). */
export function flushSSRAll(): QueuedEventUnion[] {
  if (!hasDOM()) return []; // no-op on server
  const ref = getSSRQueueRef();
  if (!ref?.length) return [];
  setSSRQueueRef(); // clear
  return ref;
}

/** Drain only essential items from the SSR queue, leaving the rest in place. */
export function flushSSREssential(): QueuedEventUnion[] {
  if (!hasDOM()) return []; // no-op on server
  const ref = getSSRQueueRef();
  if (!ref?.length) return [];
  const essentials: QueuedEventUnion[] = [];
  const keep: QueuedEventUnion[] = [];
  for (const ev of ref) {
    if (ev?.category === 'essential') essentials.push(ev);
    else keep.push(ev);
  }
  setSSRQueueRef(keep);
  return essentials;
}

/** Drop everything in the SSR queue, return how many were dropped. */
export function clearSSRAll(): number {
  const ref = getSSRQueueRef();
  const n = ref?.length ?? 0;
  setSSRQueueRef();
  return n;
}

/** Drop only non-essential items in the SSR queue, return how many were dropped. */
export function clearSSRNonEssential(): number {
  const ref = getSSRQueueRef();
  if (!ref?.length) return 0;
  let dropped = 0;
  const keep: QueuedEventUnion[] = [];
  for (const ev of ref) {
    if (ev?.category === 'essential') keep.push(ev);
    else dropped++;
  }
  setSSRQueueRef(keep);
  return dropped;
}

/**
 * Serialize queue for SSR HTML injection
 */
export function serializeSSRQueue(queue: QueuedEventUnion[]): string {
  // return `<script>window.__TRACKKIT_SSR_QUEUE__=${JSON.stringify(queue)};</script>`;
  const json = JSON.stringify(queue)
    .replace(/</g, '\\u003C') // prevent </script> break-out
    .replace(/>/g, '\\u003E')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  return `<script>window.__TRACKKIT_SSR_QUEUE__=${json};</script>`;
}

// Thin wrapper to satisfy IQueue<T>
export class SSRQueue implements IQueue {
  flush() { return flushSSRAll(); }
  flushEssential() { return flushSSREssential(); }
  clear() { return clearSSRAll(); }
  clearNonEssential() { return clearSSRNonEssential(); }
  get size() { return getSSRQueueLength(); }
}

// Legacy
export const hydrateSSRQueue = flushSSRAll;
export const clearSSRQueue = clearSSRAll;

