// ---------------------- Transport Interface ----------------------

import type { PerformanceTracker } from "../performance/tracker";

export interface Transport {
  id: string;
  send(payload: DispatchPayload): Promise<Response | void>;
}


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
  proxyUrl: string;                          // e.g. "/api/trackkit"
  token?: string;                            // optional bearer token
  headers?: Record<string, string>;          // additional static headers
  /** If true, use fetch({ keepalive: true }) for nicer unload semantics. */
  keepalive?: boolean;
  /** Optional allowlist enforcement client-side (defense-in-depth). */
  allowlist?: Array<string | RegExp>;        // target URL must match one of these
};

// ---------------------- Dispatcher Options ----------------------

export type DispatcherConfig = {
  batching?: (BatchConfig & { enabled: boolean }) | undefined;
  performance?: { enabled?: boolean; sampleRate?: number } | undefined;

  /**
   * Optional resilience options used only for NetworkItem.
   * If you never pass network items, this is ignored and the code path is dormant.
   */
  resilience?: ResilienceOptions;

  /**
   * Optional default headers merged into network sends (NetworkItem only).
   * Per-item `init?.headers` takes precedence where keys overlap.
   */
  defaultHeaders?: Record<string, string>;
};

export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  multiplier?: number;
  jitter?: boolean;
  retryableStatuses?: number[];
}

export interface BatchingOptions {
  enabled: boolean;
  maxSize?: number;
  maxWait?: number;
  maxBytes?: number;
  concurrency?: number;
  deduplication?: boolean;
  retry?: RetryOptions;
};

export interface ConnectionOptions {
  monitor?: boolean;
  offlineStorage?: boolean;
  syncInterval?: number;
  slowThreshold?: number;
  checkInterval?: number;
};

export interface PerformanceOptions {
  enabled?: boolean;
  /** Sample rate 0–1; 1 = track every event. */
  sampleRate?: number;
  /** How many recent events to keep for averages. */
  windowSize?: number;
};

export interface ResilienceOptions {
  detectBlockers?: boolean;
  proxy?: ProxyTransportOptions;
  fallbackStrategy?: 'proxy'|'beacon'|'none';
};

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

export type BatchConfig = {
  maxSize?: number;
  maxWait?: number;
  maxBytes?: number;
  concurrency?: number;
  deduplication?: boolean;
  retry?: RetryOptions;
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

export type NetworkBatching = BatchConfig & { enabled: boolean };

export type NetworkDispatcherOptions = {
  batching?: NetworkBatching;
  resilience?: ResilienceOptions;                 // plumbed into resolveTransport
  performanceTracker?: PerformanceTracker | null; // wraps sends for perf tracking
  defaultHeaders?: Record<string, string>;        // headers applied to every send
};
