// ---------------------- Transport Interface ----------------------

import type { PerformanceTracker } from "../performance/tracker";

export interface Transport {
  id: string;
  send(payload: DispatchPayload): Promise<Response | void>;
}

// ---------------------- Dispatcher Options ----------------------

/**
 * Sends analytics to a same-origin (or explicitly allowed) proxyUrl which
 * forwards to the real provider. This usually bypasses adblock filters that
 * target known analytics domains or third-party scripts.
 *
 * Server contract (recommended):
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
 * The server should validate the target against an allowlist and forward the
 * JSON payload to that URL, returning the provider response status.
 */
export type ProxyTransportOptions = {
  /** 
   * URL of the proxy endpoint to send analytics through 
   * @example "/api/trackkit"
   */
  proxyUrl: string;
  /** Optional bearer token for proxy authorization */
  token?: string;
  /** Additional static headers to include in proxy requests */
  headers?: Record<string, string>;
  /** If true, use fetch({ keepalive: true }) for nicer unload semantics. */
  keepalive?: boolean;
  /** Optional allowlist enforcement client-side (defense-in-depth). */
  allowlist?: Array<string | RegExp>;
};

export interface BatchingOptions {
  /** Enable event batching to reduce network requests */
  enabled: boolean;
  /** Number of batches that can be sent simultaneously */
  concurrency?: number;
  /** Remove duplicate events within the same batch */
  deduplication?: boolean;
  /** Maximum payload size in bytes per batch */
  maxBytes?: number;
  /** Maximum number of events per batch */
  maxSize?: number;
  /** Maximum time in milliseconds to wait before sending an incomplete batch */
  maxWait?: number;
}

/** 
 * Fully resolved batching options with defaults applied 
 * 
 * @see BatchingOptions
 */
export interface ResolvedBatchingOptions extends Required<BatchingOptions> {}

export interface ConnectionOptions {
  /** Interval in milliseconds to check network connection status */
  checkInterval?: number;
  /** Enable network connection monitoring */
  monitor?: boolean;
  /** Store events offline when network is unavailable */
  offlineStorage?: boolean;
  /** Interval in milliseconds to sync offline events when back online */
  syncInterval?: number;
  /** Threshold in milliseconds to consider a request "slow" */
  slowThreshold?: number;
}

/** 
 * Fully resolved connection options with defaults applied 
 * 
 * @see ConnectionOptions
 */
export interface ResolvedConnectionOptions extends Required<ConnectionOptions> {}

export interface PerformanceOptions {
  /** Enable performance monitoring for analytics requests */
  enabled?: boolean;
  /** Sample rate from 0 to 1 (1 = track every event, 0.1 = track 10% of events) */
  sampleRate?: number;
  /** Number of recent events to keep in memory for performance calculations */
  windowSize?: number;
}

/** 
 * Fully resolved performance options with defaults applied 
 * 
 * @see PerformanceOptions
 */
export interface ResolvedPerformanceOptions extends Required<PerformanceOptions> {}

export interface RetryOptions {
  /** Initial delay in milliseconds before first retry */
  initialDelay?: number;
  /** Add random jitter to retry delays to avoid thundering herd */
  jitter?: boolean;
  /** Maximum number of retry attempts for failed requests */
  maxAttempts?: number;
  /** Maximum delay in milliseconds between retries */
  maxDelay?: number;
  /** Multiplier for exponential backoff (e.g., 2.0 doubles delay each retry) */
  multiplier?: number;
  /**
   * HTTP status codes that should trigger a retry
   * @example [408, 429, 500, 502, 503, 504]
   */
  retryableStatuses?: number[];
}

/** 
 * Fully resolved retry options with defaults applied 
 * 
 * @see RetryOptions
 */
export interface ResolvedRetryOptions extends Required<RetryOptions> {}

/**
 * Strategy for handling failed requests and network issues
 * 'proxy'  - use a server-side proxy to send events
 * 'beacon' - use navigator.sendBeacon for best-effort delivery
 * 'none'   - do not attempt any fallback
 */
export type FallbackStrategy = 'proxy' | 'beacon' | 'none';

export interface ResilienceOptions {
  /** Detect and handle ad blockers or network issues */
  detectBlockers?: boolean;
  /** 
   * Strategy to use when primary transport fails or is blocked.
   * - 'proxy': Route through server-side proxy (requires proxy.proxyUrl)
   * - 'beacon': Use navigator.sendBeacon for best-effort delivery  
   * - 'none': Allow requests to fail naturally
   * @default Smart default: 'proxy' if proxy configured, otherwise 'beacon'
   */
  fallbackStrategy?: FallbackStrategy;
  /** Proxy configuration for bypassing ad blockers */
  proxy?: ProxyTransportOptions;
  /** Retry configuration for failed requests */
  retry?: RetryOptions;
}

/** 
 * Fully resolved resilience options with defaults applied 
 * 
 * @see ResilienceOptions
 */
export interface ResolvedResilienceOptions extends Required<Omit<ResilienceOptions, 'proxy' | 'retry'>> {
  retry: ResolvedRetryOptions;
  proxy?: ProxyTransportOptions;
}

/**
 * Configuration options for the analytics event dispatcher.
 * 
 * Controls how events are transported, batched, and handled when network
 * issues occur. These options provide fine-grained control over reliability,
 * performance, and resilience characteristics of the analytics system.
 */
export interface DispatcherOptions {
  /** Default HTTP headers applied to all outgoing requests */
  defaultHeaders?: Record<string, string>;
  /** Event batching configuration to optimize network usage */
  batching?: BatchingOptions;
  /** Network connection monitoring and offline handling */
  connection?: ConnectionOptions;
  /** Performance monitoring and sampling configuration */
  performance?: PerformanceOptions;
  /** Network resilience and error recovery configuration */
  resilience?: ResilienceOptions;
}

/** 
 * Fully resolved dispatcher options with all defaults applied
 * 
 * @see DispatcherOptions
 */
export interface ResolvedDispatcherOptions extends Required<Pick<DispatcherOptions, 'defaultHeaders'>> {
  batching: ResolvedBatchingOptions;
  connection: ResolvedConnectionOptions;
  performance: ResolvedPerformanceOptions;
  resilience: ResolvedResilienceOptions;
}

// ---------------------- Batching Types ----------------------

export type DispatchPayload = {
  url: string;
  body: unknown;
  init?: RequestInit;
}

export type BatchedEvent = {
  id: string;
  timestamp: number;
  payload: DispatchPayload; // provider-agnostic closure or serializable payload
  size: number;
  attempts?: number;
  lastError?: unknown;
};

export type Batch = {
  id: string;
  events: BatchedEvent[];
  totalSize: number;
  createdAt: number;
  attempts: number;
  status: 'pending' | 'sending' | 'sent' | 'failed';
};

// ---------------------- Network Dispatcher Types ----------------------

/**
 * Shape for direct network work items produced by providers/adapters.
 * These are "fire this HTTP request" items – NOT the facade "pageview/track" closures.
 */
export type NetworkItem = {
  id: string;
  type: 'track' | 'pageview' | 'identify';
  url: string;
  body: unknown;
  init?: RequestInit;
  /**
   * Optional estimate (bytes) used by byte-based batching. If omitted,
   * we estimate from JSON length of the body (best-effort).
   */
  size?: number;
};

export interface NetworkDispatcherOptions {
  batching: ResolvedBatchingOptions;
  resilience: ResolvedResilienceOptions;
  bustCache: boolean;
  defaultHeaders: Record<string, string>; 
  performanceTracker?: PerformanceTracker | null;
}
