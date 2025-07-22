import type { QueuedEventUnion } from './queue';

/**
 * Global queue for SSR environments
 */
declare global {
  var __TRACKKIT_SSR_QUEUE__: QueuedEventUnion[] | undefined;
}

/**
 * Check if running in SSR environment
 */
export function isSSR(): boolean {
  return typeof window === 'undefined';
  // return typeof window === 'undefined' && 
  //        typeof global !== 'undefined' &&
  //        !global.window;
}

/**
 * Get or create SSR queue
 */
export function getSSRQueue(): QueuedEventUnion[] {
  if (!isSSR()) {
    throw new Error('SSR queue should only be used in server environment');
  }

  if (!globalThis.__TRACKKIT_SSR_QUEUE__) {
    globalThis.__TRACKKIT_SSR_QUEUE__ = [];
  }

  return globalThis.__TRACKKIT_SSR_QUEUE__;
}

export function getSSRQueueLength(): number {
  if (typeof window === 'undefined') {
    return 0;
  }

  if (globalThis.__TRACKKIT_SSR_QUEUE__) {
    return globalThis.__TRACKKIT_SSR_QUEUE__.length;
  }

  return 0;
}

export function clearSSRQueue(): void {
  if (globalThis.__TRACKKIT_SSR_QUEUE__) {
    delete globalThis.__TRACKKIT_SSR_QUEUE__;
  }
}

/**
 * Transfer SSR queue to client
 */
export function hydrateSSRQueue(): QueuedEventUnion[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  const queue = globalThis.__TRACKKIT_SSR_QUEUE__ || [];
  
  // Clear after reading to prevent duplicate processing
  clearSSRQueue();
  
  return queue;
}

/**
 * Serialize queue for SSR HTML injection
 */
export function serializeSSRQueue(queue: QueuedEventUnion[]): string {
  // return `<script>window.__TRACKKIT_SSR_QUEUE__=${JSON.stringify(queue)};</script>`;
  const json = JSON.stringify(queue)
    .replace(/</g, '\\u003C') // prevent </script> break-out
    .replace(/>/g, '\\u003E');
  return `<script>window.__TRACKKIT_SSR_QUEUE__=${json};</script>`;
}