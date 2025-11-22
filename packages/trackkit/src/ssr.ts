/**
 * SSR entry point for trackkit/ssr
 * 
 * Exports server-side tracking functions and SSR queue utilities.
 * Use this module when you need to track events during SSR and serialize
 * the queue for client hydration.
 */

// Re-export server-safe tracking functions (they detect SSR automatically)
export {
  track as ssrTrack,
  pageview as ssrPageview,
  identify as ssrIdentify
} from './facade/singleton';


// SSR queue helpers (advanced)
// Trackkit maintains a single SSR event queue per page via window.__TRACKKIT_SSR_QUEUE__.
// These helpers are for advanced integrations that need to inspect or
// manipulate the SSR queue directly. Most apps only need `serializeSSRQueue()`
// from the `trackkit/ssr` entry and should avoid touching the queue internals.
export {
  serializeSSRQueue,
  getSSRQueue,
  getSSRQueueLength,
  enqueueSSREvent,
} from './queues/ssr';
