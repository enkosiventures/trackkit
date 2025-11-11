// import { EventBatchProcessor, type BatchConfig } from './batch-processor';
// import { PerformanceTracker } from '../performance/tracker';
// import type { ResilienceOptions, Transport } from './transports';
// import { resolveTransport } from './transports';

// // ---------------------------------------------
// // Public shapes (backwards compatible)
// // ---------------------------------------------

// export type DispatchItem = {
//   id: string;
//   type: 'track' | 'pageview' | 'identify';
//   /** Provider call closure (existing callers already pass this) */
//   run: () => Promise<void> | void;
//   /** Optional byte estimate for batching heuristics */
//   size?: number;
// };

// /**
//  * Optional "network" variant. If you pass this, Dispatcher will
//  * resolve a Transport (Fetch/Beacon/Proxy) according to resilience options,
//  * convert it to a `run` closure, and then treat it like a normal item.
//  *
//  * You can use either `DispatchItem` (with a run closure) or this network form.
//  */
// export type NetworkItem = {
//   id: string;
//   type: 'track' | 'pageview' | 'identify';
//   /** Target URL to POST to */
//   url: string;
//   /** Payload to send; transport decides how to serialize */
//   payload: unknown;
//   /** Optional RequestInit headers/opts merged in by the transport */
//   init?: RequestInit;
//   size?: number;
// };

// // A narrow union that enqueue() can accept
// type AnyEnqueueItem = DispatchItem | NetworkItem;

// /** Dispatcher configuration */
// export type DispatcherConfig = {
//   batching?: (BatchConfig & { enabled: boolean }) | undefined;
//   performance?: { enabled?: boolean; sampleRate?: number } | undefined;

//   /**
//    * Optional resilience options used only for NetworkItem.
//    * If you never pass network items, this is ignored and the code path is dormant.
//    */
//   resilience?: ResilienceOptions;

//   /**
//    * Optional default headers merged into network sends (NetworkItem only).
//    * Per-item `init?.headers` takes precedence where keys overlap.
//    */
//   defaultHeaders?: Record<string, string>;
// };

// // ---------------------------------------------
// // Dispatcher
// // ---------------------------------------------

// export class Dispatcher {
//   private batch?: EventBatchProcessor;
//   private perf?: PerformanceTracker;

//   // Transport is resolved lazily on first use of a "network" item
//   private transportP: Promise<Transport> | null = null;

//   constructor(private cfg: DispatcherConfig) {
//     if (cfg.performance?.enabled) {
//       this.perf = new PerformanceTracker();
//     }

//     if (cfg.batching?.enabled) {
//       // The batch-processor still receives closures and calls them one by one.
//       this.batch = new EventBatchProcessor(cfg.batching, (batch) =>
//         this.sendBatch(batch.events)
//       );
//     }
//   }

//   /**
//    * Enqueue either:
//    *  - a classic item with a `run` closure (backwards compatible), or
//    *  - a network-shaped item (Dispatcher will produce a `run` closure for it).
//    */
//   enqueue(item: AnyEnqueueItem) {
//     // Normalize to an internal item that *always* has a run closure:
//     const normalized = this.normalize(item);

//     if (!this.batch) {
//       // No batching: just run (perf-tracked if enabled)
//       return this.execute(normalized);
//     }

//     // Batching: add with size hint
//     this.batch.add({
//       id: normalized.id,
//       timestamp: Date.now(),
//       type: normalized.type,
//       payload: { run: normalized.run },
//       size: normalized.size ?? 100,
//     });
//     return Promise.resolve();
//   }

//   /** Flush pending batches (no-op if batching disabled) */
//   async flush() {
//     await this.batch?.flush();
//   }

//   /** Stop timers and tear down (no-op safe) */
//   destroy() {
//     this.batch?.destroy();
//   }

//   // ---------------------------------------------
//   // Internals
//   // ---------------------------------------------

//   /**
//    * Convert either a closure-based item or network-shaped item
//    * into an internal item with a `run` closure.
//    */
//   private normalize(item: AnyEnqueueItem): Required<Pick<DispatchItem, 'id' | 'type' | 'run'>> & { size?: number } {
//     // If it's already a closure-based item, just return it as-is (plus size)
//     if ('run' in item && typeof item.run === 'function') {
//       return { id: item.id, type: item.type, run: item.run, size: item.size };
//     }

//     // Otherwise, it's a network-shaped item. Produce a run closure that uses Transport.
//     const n = item as NetworkItem;
//     const mkRun = async () => {
//       const t = await this.ensureTransport();
//       // Merge default headers with per-item init headers; per-item wins.
//       const mergedInit: RequestInit = {
//         ...(n.init || {}),
//         headers: {
//           ...(this.cfg.defaultHeaders || {}),
//           ...(normalizeHeaders(n.init?.headers)),
//         },
//       };
//       await t.send(n.url, n.payload, mergedInit);
//     };

//     return { id: n.id, type: n.type, run: mkRun, size: n.size };
//   }

//   /** Ensure we have a resolved Transport (once). Only used for network-shaped items. */
//   private async ensureTransport(): Promise<Transport> {
//     if (!this.transportP) {
//       const t = resolveTransport(this.cfg.resilience);
//       this.transportP = Promise.resolve(t);
//     }
//     return this.transportP;
//   }

//   /** Send a batch by running each event’s closure (perf-tracked if enabled). */
//   private async sendBatch(
//     events: { id: string; payload: { run: () => Promise<void> | void } }[]
//   ) {
//     for (const e of events) {
//       await this.execute({ id: e.id, type: 'track', run: e.payload.run });
//     }
//   }

//   /** Execute a single item (with optional perf tracking) */
//   private run(item: DispatchItem) {
//     return Promise.resolve(item.run());
//   }

//   private execute(item: DispatchItem) {
//     if (!this.perf) return this.run(item);
//     return this.perf.trackNetworkRequest(item.type, async () => {
//       await this.run(item);
//     });
//   }

//   // ---------------------------------------------
//   // Test seam (optional)
//   // ---------------------------------------------

//   /** For tests: inject a transport directly to bypass resolver/detection. */
//   /* istanbul ignore next */
//   _setTransportForTests(t: Transport) {
//     this.transportP = Promise.resolve(t);
//   }
// }

// // ---------------------------------------------
// // Helpers
// // ---------------------------------------------

// /**
//  * Normalize a headers value (Headers | Record | undefined) into a plain object.
//  * Keeps the semantics of your existing Fetch transport normalization.
//  */
// function normalizeHeaders(
//   headers?: HeadersInit
// ): Record<string, string> | undefined {
//   if (!headers) return undefined;
//   if (headers instanceof Headers) {
//     return Object.fromEntries(headers.entries());
//   }
//   if (Array.isArray(headers)) {
//     return Object.fromEntries(headers);
//   }
//   return { ...(headers as Record<string, string>) };
// }
