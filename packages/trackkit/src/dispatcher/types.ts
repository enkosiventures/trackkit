// // ---------------------- Transport Interface ----------------------

// import type { PerformanceTracker } from "../performance/tracker";

// export interface Transport {
//   id: string;
//   send(payload: DispatchPayload): Promise<Response | void>;
// }

// // ---------------------- Dispatcher Options ----------------------

// /**
//  * Sends analytics to a same-origin (or explicitly allowed) proxyUrl which
//  * forwards to the real provider. This usually bypasses adblock filters that
//  * target known analytics domains or third-party scripts.
//  *
//  * Server contract (recommended):
//  * 
//  * ```http
//  * POST {proxyUrl}
//  * Headers:
//  *   Content-Type: application/json
//  *   Authorization: Bearer <token>         (optional)
//  *   X-Trackkit-Target: <provider URL>     (required)
//  * Body: { "payload": any }
//  * ```
//  *
//  * The server should validate the target against an allowlist and forward the
//  * JSON payload to that URL, returning the provider response status.
//  */
// export type ProxyTransportOptions = {
//   /** 
//    * URL of the proxy endpoint to send analytics through 
//    * @example "/api/trackkit"
//    */
//   proxyUrl: string;
//   /** Optional bearer token for proxy authorization */
//   token?: string;
//   /** Additional static headers to include in proxy requests */
//   headers?: Record<string, string>;
//   /** If true, use fetch({ keepalive: true }) for nicer unload semantics. */
//   keepalive?: boolean;
//   /** Optional allowlist enforcement client-side (defense-in-depth). */
//   allowlist?: Array<string | RegExp>;
// };

// /**
//  * Controls how individual provider HTTP requests are grouped into batches.
//  *
//  * Batching happens inside the network dispatcher and is independent of the
//  * facade-level queue. It reduces network overhead by co-ordinating sends,
//  * but never changes the semantic ordering of events within a batch.
//  *
//  * All fields are optional except `enabled`. Unset fields fall back to
//  * library defaults.
//  */
// export interface BatchingOptions {
//   /** Enable event batching to reduce network requests */
//   enabled: boolean;
//   /** Number of batches that can be sent simultaneously */
//   concurrency?: number;
//   /** Remove duplicate events within the same batch */
//   deduplication?: boolean;
//   /** Maximum payload size in bytes per batch */
//   maxBytes?: number;
//   /** Maximum number of events per batch */
//   maxSize?: number;
//   /** Maximum time in milliseconds to wait before sending an incomplete batch */
//   maxWait?: number;
// }

// /** 
//  * Fully resolved batching options with defaults applied 
//  * 
//  * @see BatchingOptions
//  */
// export interface ResolvedBatchingOptions extends Required<BatchingOptions> {}

// export interface ConnectionOptions {
//   /** Interval in milliseconds to check network connection status */
//   checkInterval?: number;
//   /** Enable network connection monitoring */
//   monitor?: boolean;
//   /** Store events offline when network is unavailable */
//   offlineStorage?: boolean;
//   /** Interval in milliseconds to sync offline events when back online */
//   syncInterval?: number;
//   /** Threshold in milliseconds to consider a request "slow" */
//   slowThreshold?: number;
// }

// /** 
//  * Fully resolved connection options with defaults applied 
//  * 
//  * @see ConnectionOptions
//  */
// export interface ResolvedConnectionOptions extends Required<ConnectionOptions> {}

// export interface PerformanceOptions {
//   /** Enable performance monitoring for analytics requests */
//   enabled?: boolean;
//   /** Sample rate from 0 to 1 (1 = track every event, 0.1 = track 10% of events) */
//   sampleRate?: number;
//   /** Number of recent events to keep in memory for performance calculations */
//   windowSize?: number;
// }

// /** 
//  * Fully resolved performance options with defaults applied 
//  * 
//  * @see PerformanceOptions
//  */
// export interface ResolvedPerformanceOptions extends Required<PerformanceOptions> {}

// export interface RetryOptions {
//   /** Initial delay in milliseconds before first retry */
//   initialDelay?: number;
//   /** Add random jitter to retry delays to avoid thundering herd */
//   jitter?: boolean;
//   /** Maximum number of retry attempts for failed requests */
//   maxAttempts?: number;
//   /** Maximum delay in milliseconds between retries */
//   maxDelay?: number;
//   /** Multiplier for exponential backoff (e.g., 2.0 doubles delay each retry) */
//   multiplier?: number;
//   /**
//    * HTTP status codes that should trigger a retry
//    * @example [408, 429, 500, 502, 503, 504]
//    */
//   retryableStatuses?: number[];
// }

// /** 
//  * Fully resolved retry options with defaults applied 
//  * 
//  * @see RetryOptions
//  */
// export interface ResolvedRetryOptions extends Required<RetryOptions> {}

// /**
//  * Strategy for handling failed requests and network issues
//  * 'proxy'  - use a server-side proxy to send events
//  * 'beacon' - use navigator.sendBeacon for best-effort delivery
//  * 'none'   - do not attempt any fallback
//  */
// export type FallbackStrategy = 'proxy' | 'beacon' | 'none';

// export type ResilienceOptions = {
//   /** Detect and handle ad blockers or network issues */
//   detectBlockers?: boolean;
//   /** 
//    * Strategy to use when primary transport fails or is blocked.
//    * - 'proxy': Route through server-side proxy (requires proxy.proxyUrl)
//    * - 'beacon': Use navigator.sendBeacon for best-effort delivery  
//    * - 'none': Allow requests to fail naturally
//    * @default Smart default: 'proxy' if proxy configured, otherwise 'beacon'
//    */
//   fallbackStrategy?: FallbackStrategy;
//   /** Proxy configuration for bypassing ad blockers */
//   proxy?: ProxyTransportOptions;
//   /** Retry configuration for failed requests */
//   retry?: RetryOptions;
// }

// /** 
//  * Fully resolved resilience options with defaults applied 
//  * 
//  * @see ResilienceOptions
//  */
// export interface ResolvedResilienceOptions extends Required<Omit<ResilienceOptions, 'proxy' | 'retry'>> {
//   retry: ResolvedRetryOptions;
//   proxy?: ProxyTransportOptions;
// }

// /**
//  * Controls which low-level transport implementation Trackkit uses to send
//  * provider HTTP requests.
//  *
//  * The mode affects how the dispatcher chooses between `fetch`, `sendBeacon`,
//  * and an optional proxy transport. It also controls whether ad-block detection
//  * and `fallbackStrategy` are consulted.
//  *
//  * - `'smart'` (default)
//  *   Uses the **adaptive** transport strategy:
//  *
//  *   - If `resilience.detectBlockers !== true`, uses `FetchTransport` for all
//  *     sends.
//  *   - If detection is enabled and **no blocker** is detected, still uses
//  *     `FetchTransport`.
//  *   - If a blocker *is* detected, chooses a fallback based on:
//  *       1. `resilience.fallbackStrategy` (if explicitly set),
//  *       2. any hint provided by the ad-block detector, and
//  *       3. whether a `resilience.proxy.proxyUrl` is configured.
//  *
//  *   In practice:
//  *   - When a proxy is configured, the smart default is `"proxy"`.
//  *   - Otherwise, the smart default is `"beacon"`.
//  *
//  *   This mode is opinionated: it tries to “do the sensible thing” under
//  *   ad-blockers without you having to think about transports at all.
//  *
//  * - `'fetch'`
//  *   Always uses `FetchTransport` for sends.
//  *
//  *   - Ignores ad-block detection, `resilience.detectBlockers`, and
//  *     `resilience.fallbackStrategy`.
//  *   - Useful when you want completely predictable behaviour or you know
//  *     `sendBeacon` is unreliable / unnecessary in your environment.
//  *
//  * - `'beacon'`
//  *   Always **prefers** `BeaconTransport` when `navigator.sendBeacon` is
//  *   available, falling back to `FetchTransport` where beacon isn’t supported.
//  *
//  *   - Ignores ad-block detection and `fallbackStrategy`.
//  *   - Suitable when you want best-effort, fire-and-forget behaviour on page
//  *     unload, and you’re willing to accept beacon’s limitations.
//  *
//  * - `'proxy'`
//  *   Always uses `ProxiedTransport`.
//  *
//  *   - Requires `resilience.proxy.proxyUrl` to be configured.
//  *   - If `transportMode` is explicitly `'proxy'` but no `proxyUrl` is defined,
//  *     this is treated as invalid configuration.
//  *   - Ignores ad-block detection and `fallbackStrategy`.
//  *
//  *   This mode is appropriate when you **mandate** that all analytics traffic
//  *   goes through your own backend (e.g., for compliance or network policy).
//  *
//  * - `'noop'`
//  *   Never performs real network I/O.
//  *
//  *   - Events still run through the dispatcher pipeline (queueing, batching,
//  *     diagnostics, performance tracking), but the selected transport is a
//  *     no-op.
//  *   - Intended for tests, local development, and playgrounds where you want
//  *     realistic queue/diagnostics behaviour without actually sending data.
//  */
// export type TransportMode =
//   | 'smart'
//   | 'fetch'
//   | 'beacon'
//   | 'proxy'
//   | 'noop';

// /**
//  * Configuration for the low-level network dispatcher.
//  *
//  * This container controls how provider HTTP requests are sent, grouped,
//  * retried and measured. It wraps several option groups:
//  *
//  * - {@link TransportMode | transport}:
//  *   choose the low-level transport strategy.
//  * - {@link BatchingOptions | batching}:
//  *   control how events are grouped into batches.
//  * - {@link ResilienceOptions | resilience}:
//  *   retries, ad-block handling and proxy settings.
//  * - {@link ConnectionOptions | connection}:
//  *   reachability and offline monitoring.
//  * - {@link PerformanceOptions | performance}:
//  *   sampling and timing metrics.
//  *
//  * Most applications only set a small subset of these; everything else falls
//  * back to sensible defaults.
//  */
// export interface DispatcherOptions {
//   /**
//    * Low-level strategy to use for sending events.
//    *
//    * Defaults to `'smart'`, which adapts to ad-blockers and your
//    * {@link ResilienceOptions | resilience} configuration.
//    * See {@link TransportMode} for full semantics.
//    */
//   transport?: TransportMode;

//   /**
//    * Default HTTP headers applied to every outgoing request before
//    * provider-specific headers.
//    */
//   defaultHeaders?: Record<string, string>;

//   /**
//    * Event batching configuration to optimise network usage.
//    *
//    * See {@link BatchingOptions} for available knobs.
//    */
//   batching?: BatchingOptions;

//   /**
//    * Network connection monitoring and offline handling.
//    *
//    * See {@link ConnectionOptions} for details.
//    */
//   connection?: ConnectionOptions;

//   /**
//    * Performance monitoring and sampling configuration.
//    *
//    * See {@link PerformanceOptions}.
//    */
//   performance?: PerformanceOptions;

//   /**
//    * Network resilience and error recovery configuration.
//    *
//    * See {@link ResilienceOptions}.
//    */
//   resilience?: ResilienceOptions;
// }


// /** 
//  * Fully resolved dispatcher options with all defaults applied
//  * 
//  * @see DispatcherOptions
//  */
// export interface ResolvedDispatcherOptions extends Required<Pick<DispatcherOptions, 'defaultHeaders' | 'transport'>> {
//   batching: ResolvedBatchingOptions;
//   connection: ResolvedConnectionOptions;
//   performance: ResolvedPerformanceOptions;
//   resilience: ResolvedResilienceOptions;
// }

// // ---------------------- Batching Types ----------------------

// export type DispatchPayload = {
//   url: string;
//   body: unknown;
//   init?: RequestInit;
// }

// export type BatchedEvent = {
//   id: string;
//   timestamp: number;
//   payload: DispatchPayload; // provider-agnostic closure or serializable payload
//   size: number;
//   attempts?: number;
//   lastError?: unknown;
// };

// export type Batch = {
//   id: string;
//   events: BatchedEvent[];
//   totalSize: number;
//   createdAt: number;
//   attempts: number;
//   status: 'pending' | 'sending' | 'sent' | 'failed';
// };

// // ---------------------- Network Dispatcher Types ----------------------

// /**
//  * Shape for direct network work items produced by providers/adapters.
//  * These are "fire this HTTP request" items – NOT the facade "pageview/track" closures.
//  */
// export type NetworkItem = {
//   id: string;
//   type: 'track' | 'pageview' | 'identify';
//   url: string;
//   body: unknown;
//   init?: RequestInit;
//   /**
//    * Optional estimate (bytes) used by byte-based batching. If omitted,
//    * we estimate from JSON length of the body (best-effort).
//    */
//   size?: number;
// };

// export interface NetworkDispatcherOptions {
//   batching: ResolvedBatchingOptions;
//   resilience: ResolvedResilienceOptions;
//   bustCache: boolean;
//   defaultHeaders: Record<string, string>; 
//   performanceTracker?: PerformanceTracker | null;
//   transportOverride?: Transport;
// }


// src/dispatcher/types.ts

import { DiagnosticsService } from '../facade/diagnostics';
import type { PerformanceTracker } from '../performance/tracker';

/**
 * Low-level transport contract used by the dispatcher.
 *
 * A transport is responsible for sending a single HTTP request described by
 * a {@link DispatchPayload}. Concrete implementations include:
 *
 * - `FetchTransport`
 * - `BeaconTransport`
 * - `ProxiedTransport`
 * - a `NoopTransport` used in playgrounds/tests
 */
export interface Transport {
  /** Identifier for diagnostics (e.g. `"fetch"`, `"beacon"`, `"proxy"`). */
  id: string;

  /**
   * Send a single network payload.
   *
   * @param payload - Provider-agnostic HTTP payload (URL, body, init).
   * @returns A `Response` (or `void` for beacon-like transports).
   */
  send(payload: DispatchPayload): Promise<Response | void>;
}

/**
 * Sends analytics to a same-origin (or explicitly allowed) proxy URL which
 * forwards to the real provider.
 *
 * This usually bypasses ad blockers that target known analytics domains
 * or third-party scripts.
 *
 * Recommended server contract:
 *
 * ```http
 * POST {proxyUrl}
 * Headers:
 *   Content-Type: application/json
 *   Authorization: Bearer <token>         (optional)
 *   X-Trackkit-Target: <provider URL>     (required)
 * Body: { "payload": any }
 * ```
 *
 * The server should validate the target against an allowlist and forward
 * the JSON payload to that URL, returning the provider response status.
 */
export type ProxyTransportOptions = {
  /**
   * URL of the proxy endpoint to send analytics through.
   *
   * @example "/api/trackkit"
   */
  proxyUrl: string;

  /**
   * Optional bearer token for proxy authorisation.
   */
  token?: string;

  /**
   * Additional static headers to include in proxy requests.
   */
  headers?: Record<string, string>;

  /**
   * If `true`, use `fetch({ keepalive: true })` for nicer unload semantics.
   */
  keepalive?: boolean;

  /**
   * Optional allowlist enforcement client-side (defence-in-depth).
   *
   * When set, the proxy target URL must match at least one entry in this
   * list or the request will be blocked by the client.
   */
  allowlist?: Array<string | RegExp>;
};

/**
 * Controls how individual provider HTTP requests are grouped into batches.
 *
 * Batching happens inside the network dispatcher and is independent of the
 * facade-level queue. It reduces network overhead by co-ordinating sends,
 * but never changes the semantic ordering of events within a batch.
 *
 * All fields are optional except `enabled`. Unset fields fall back to
 * library defaults.
 */
export interface BatchingOptions {
  /** Enable event batching to reduce network requests. */
  enabled: boolean;

  /**
   * Maximum number of events per batch.
   *
   * When reached, the batch is flushed even if `maxWait` has not elapsed.
   */
  maxSize?: number;

  /**
   * Maximum time in milliseconds to wait before sending an incomplete batch.
   */
  maxWait?: number;

  /**
   * Maximum payload size in bytes per batch.
   *
   * Useful for staying under gateway/proxy limits.
   */
  maxBytes?: number;

  /**
   * Number of batches that can be in-flight simultaneously.
   */
  concurrency?: number;

  /**
   * Remove duplicate events within the same batch.
   *
   * Deduplication is based on dispatcher-level heuristics.
   */
  deduplication?: boolean;
}

/**
 * Fully resolved batching options with defaults applied.
 *
 * @see BatchingOptions
 * @internal
 */
export interface ResolvedBatchingOptions extends Required<BatchingOptions> {}

/**
 * Network connection and offline handling options.
 */
export interface ConnectionOptions {
  /**
   * Enable network connection monitoring.
   *
   * When `true`, the dispatcher may record reachability state and adapt
   * behaviour when offline.
   */
  monitor?: boolean;

  /**
   * Store events offline when network is unavailable.
   *
   * Exact storage semantics are implementation-dependent.
   */
  offlineStorage?: boolean;

  /**
   * Interval in milliseconds to check network connection status.
   */
  checkInterval?: number;

  /**
   * Interval in milliseconds to sync offline events when back online.
   */
  syncInterval?: number;

  /**
   * Threshold in milliseconds to consider a request "slow".
   *
   * Used by performance monitoring / diagnostics.
   */
  slowThreshold?: number;
}

/**
 * Fully resolved connection options with defaults applied.
 *
 * @see ConnectionOptions
 * @internal
 */
export interface ResolvedConnectionOptions
  extends Required<ConnectionOptions> {}

/**
 * Performance monitoring options for network sends.
 */
export interface PerformanceOptions {
  /**
   * Enable performance monitoring for analytics requests.
   */
  enabled?: boolean;

  /**
   * Sample rate from `0` to `1`.
   *
   * - `1`   – track every request
   * - `0.1` – track ~10% of requests
   */
  sampleRate?: number;

  /**
   * Number of recent events to keep in memory for performance calculations.
   */
  windowSize?: number;
}

/**
 * Fully resolved performance options with defaults applied.
 *
 * @see PerformanceOptions
 * @internal
 */
export interface ResolvedPerformanceOptions
  extends Required<PerformanceOptions> {}

/**
 * Retry/backoff configuration for failed requests.
 */
export interface RetryOptions {
  /**
   * Maximum number of retry attempts for a failed request.
   */
  maxAttempts?: number;

  /**
   * Initial delay in milliseconds before the first retry.
   */
  initialDelay?: number;

  /**
   * Maximum delay in milliseconds between retries.
   */
  maxDelay?: number;

  /**
   * Multiplier for exponential backoff (e.g. `2.0` doubles delay each retry).
   */
  multiplier?: number;

  /**
   * Add random jitter to retry delays to avoid thundering herd effects.
   */
  jitter?: boolean;

  /**
   * HTTP status codes that should trigger a retry.
   *
   * @example [408, 429, 500, 502, 503, 504]
   */
  retryableStatuses?: number[];
}

/**
 * Fully resolved retry options with defaults applied.
 *
 * @see RetryOptions
 * @internal
 */
export interface ResolvedRetryOptions extends Required<RetryOptions> {}

/**
 * Strategy for handling failed requests and network issues when a
 * blocker is detected.
 *
 * See {@link TransportMode} for mode details.
 */
export type FallbackStrategy = Extract<TransportMode, 'proxy' | 'beacon'>;

/**
 * Network resilience configuration.
 *
 * These options control how the dispatcher:
 * - detects ad blockers,
 * - chooses fallbacks,
 * - and configures proxy + retry behaviour.
 */
export type ResilienceOptions = {
  /**
   * Detect and handle ad blockers or network issues.
   *
   * When `true`, the dispatcher may probe the environment and adjust
   * transport behaviour to work around blocking.
   */
  detectBlockers?: boolean;

  /**
   * Suggested fallback strategy to circumvent ad blockers.
   *
   * - `'proxy'`: Route through a server-side proxy (requires
   *   {@link ResilienceOptions.proxy | proxy.proxyUrl}).
   * - `'beacon'`: Use `navigator.sendBeacon` for best-effort delivery.
   */
  fallbackStrategy?: FallbackStrategy;

  /**
   * Proxy configuration for bypassing ad blockers.
   *
   * See {@link ProxyTransportOptions}.
   */
  proxy?: ProxyTransportOptions;

  /**
   * Retry configuration for failed requests.
   *
   * See {@link RetryOptions}.
   */
  retry?: RetryOptions;
};

/**
 * Fully resolved resilience options with defaults applied.
 *
 * @see ResilienceOptions
 * @internal
 */
export interface ResolvedResilienceOptions
  extends Required<Omit<ResilienceOptions, 'proxy' | 'retry'>> {
  retry: ResolvedRetryOptions;
  proxy?: ProxyTransportOptions;
}

/**
 * Controls which low-level transport implementation Trackkit uses to send
 * provider HTTP requests.
 *
 * The mode affects how the dispatcher chooses between `fetch`, `sendBeacon`,
 * an optional proxy transport, or a no-op.
 *
 * See the docs for how each mode interacts with
 * {@link ResilienceOptions.detectBlockers | detectBlockers} and
 * {@link ResilienceOptions.fallbackStrategy | fallbackStrategy}.
 */
export type TransportMode =
  /**
   * Default: adaptive transport strategy.
   *
   * - If blocker detection is disabled, always uses `FetchTransport`.
   * - If enabled and no blocker is detected, still uses `FetchTransport`.
   * - If a blocker *is* detected, chooses a fallback based on:
   *   - `resilience.fallbackStrategy` (if explicitly set),
   *   - any hint provided by the ad-block detector,
   *   - whether a proxy URL is configured.
   */
  | 'smart'
  /**
   * Always use `FetchTransport` for sends.
   *
   * Ignores ad-block detection and fallback strategy.
   */
  | 'fetch'
  /**
   * Prefer `BeaconTransport` when available, falling back to `FetchTransport`
   * where `navigator.sendBeacon` is not supported.
   *
   * Ignores ad-block detection and fallback strategy.
   */
  | 'beacon'
  /**
   * Always use `ProxiedTransport`.
   *
   * Requires a configured proxy URL. Ignores ad-block detection and
   * fallback strategy.
   */
  | 'proxy'
  /**
   * Never perform real network I/O.
   *
   * Events still flow through the dispatcher pipeline (queueing, batching,
   * diagnostics, performance tracking), but the selected transport is a
   * no-op.
   *
   * Intended for tests, local development and playgrounds.
   */
  | 'noop';

/**
 * Configuration for the low-level network dispatcher.
 *
 * This container controls how provider HTTP requests are sent, grouped,
 * retried and measured. It wraps several option groups:
 *
 * - {@link TransportMode | transport}:
 *   choose the low-level transport strategy.
 * - {@link BatchingOptions | batching}:
 *   control how events are grouped into batches.
 * - {@link ResilienceOptions | resilience}:
 *   retries, ad-block handling and proxy settings.
 * - {@link ConnectionOptions | connection}:
 *   reachability and offline monitoring.
 * - {@link PerformanceOptions | performance}:
 *   sampling and timing metrics.
 *
 * Most applications only set a small subset of these; everything else falls
 * back to sensible defaults.
 */
export interface DispatcherOptions {
  /**
   * Low-level strategy to use for sending events.
   *
   * Defaults to `'smart'`, which adapts to ad-blockers and your
   * {@link ResilienceOptions | resilience} configuration.
   * See {@link TransportMode} for full semantics.
   */
  transportMode?: TransportMode;

  /**
   * Default HTTP headers applied to every outgoing request before
   * provider-specific headers.
   */
  defaultHeaders?: Record<string, string>;

  /**
   * Event batching configuration to optimise network usage.
   *
   * See {@link BatchingOptions} for available knobs.
   */
  batching?: BatchingOptions;

  /**
   * Network connection monitoring and offline handling.
   *
   * See {@link ConnectionOptions} for details.
   */
  connection?: ConnectionOptions;

  /**
   * Performance monitoring and sampling configuration.
   *
   * See {@link PerformanceOptions}.
   */
  performance?: PerformanceOptions;

  /**
   * Network resilience and error recovery configuration.
   *
   * See {@link ResilienceOptions}.
   */
  resilience?: ResilienceOptions;
}

/**
 * Fully resolved dispatcher options with all defaults applied.
 *
 * @see DispatcherOptions
 * @internal
 */
export interface ResolvedDispatcherOptions
  extends Required<Pick<DispatcherOptions, 'defaultHeaders' | 'transportMode'>> {
  batching: ResolvedBatchingOptions;
  connection: ResolvedConnectionOptions;
  performance: ResolvedPerformanceOptions;
  resilience: ResolvedResilienceOptions;
}

// ---------------------- Batching Types ----------------------

/**
 * Provider-agnostic HTTP payload passed to the transport layer.
 */
export type DispatchPayload = {
  /** Target URL (absolute or relative). */
  url: string;
  /** Payload body (typically serialised to JSON). */
  body: unknown;
  /** Additional `fetch`-style initialiser options. */
  init?: RequestInit;
};

/**
 * Internal representation of an event in the batching queue.
 *
 * @internal
 */
export type BatchedEvent = {
  /** Stable identifier for the event within the batch. */
  id: string;
  /** Timestamp when the event was enqueued (ms since epoch). */
  timestamp: number;
  /** Provider-agnostic payload. */
  payload: DispatchPayload;
  /** Size estimate used for byte-based batching. */
  size: number;
  /** Number of send attempts so far. */
  attempts?: number;
  /** Last error seen while attempting to send. */
  lastError?: unknown;
};

/**
 * Internal batching structure representing a group of events.
 *
 * @internal
 */
export type Batch = {
  /** Stable batch identifier. */
  id: string;
  /** Events contained within this batch. */
  events: BatchedEvent[];
  /** Total estimated size of the batch in bytes. */
  totalSize: number;
  /** Creation timestamp (ms since epoch). */
  createdAt: number;
  /** Number of send attempts. */
  attempts: number;
  /** Current batch status. */
  status: 'pending' | 'sending' | 'sent' | 'failed';
};

// ---------------------- Network Dispatcher Types ----------------------

/**
 * Shape for direct network work items produced by providers/adapters.
 *
 * These are "fire this HTTP request" items – *not* the facade-level
 * `"pageview"/"track"` closures.
 */
export type NetworkItem = {
  /** Stable request identifier. */
  id: string;
  /** High-level operation type (pageview, track, identify). */
  type: 'track' | 'pageview' | 'identify';
  /** Target URL for the request. */
  url: string;
  /** Request body (typically serialised to JSON by the dispatcher). */
  body: unknown;
  /** Optional fetch initialiser overrides. */
  init?: RequestInit;
  /**
   * Optional size estimate in bytes.
   *
   * If omitted, the dispatcher estimates size from `body` using JSON length.
   */
  size?: number;
};

/**
 * Internal options passed to the {@link NetworkDispatcher}.
 *
 * These are already defaulted and normalised; external callers should use
 * {@link DispatcherOptions} instead.
 *
 * @internal
 */
export interface NetworkDispatcherOptions {
  batching: ResolvedBatchingOptions;
  resilience: ResolvedResilienceOptions;
  bustCache: boolean;
  transportMode: TransportMode;
  defaultHeaders: Record<string, string>;
  diagnostics?: DiagnosticsService | null;
  performanceTracker?: PerformanceTracker | null;
  /**
   * Optional explicit transport override.
   *
   * Primarily intended for tests and specialised use-cases; most callers
   * should configure {@link transportMode} instead.
   */
  transportOverride?: Transport;
}
