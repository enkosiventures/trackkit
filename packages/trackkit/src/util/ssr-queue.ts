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
  return typeof window === 'undefined' && 
         typeof global !== 'undefined' &&
         !global.window;
}

/**
 * Get or create SSR queue
 */
export function getSSRQueue(): QueuedEventUnion[] {
  if (!isSSR()) {
    throw new Error('SSR queue should only be used in server environment');
  }
  
  if (!global.__TRACKKIT_SSR_QUEUE__) {
    global.__TRACKKIT_SSR_QUEUE__ = [];
  }
  
  return global.__TRACKKIT_SSR_QUEUE__;
}

/**
 * Transfer SSR queue to client
 */
export function hydrateSSRQueue(): QueuedEventUnion[] {
  if (typeof window === 'undefined') {
    return [];
  }
  
  const queue = (window as any).__TRACKKIT_SSR_QUEUE__ || [];
  
  // Clear after reading to prevent duplicate processing
  if ((window as any).__TRACKKIT_SSR_QUEUE__) {
    delete (window as any).__TRACKKIT_SSR_QUEUE__;
  }
  
  return queue;
}

/**
 * Serialize queue for SSR HTML injection
 */
export function serializeSSRQueue(queue: QueuedEventUnion[]): string {
  return `<script>window.__TRACKKIT_SSR_QUEUE__=${JSON.stringify(queue)};</script>`;
}