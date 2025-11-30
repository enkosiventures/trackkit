import type { NetworkDispatcherOptions } from "../../dispatcher";
import { NetworkDispatcher } from "../../dispatcher";
import { TransportMode } from "../../dispatcher/types";

/**
 * Shared transport layer used by all providers.
 * - Uses navigator.sendBeacon when possible (optional size guard)
 * - Falls back to fetch with keepalive
 * - Centralizes headers/body serialization
 *
 * Cache behavior:
 *   bustCache === true  -> enable cache-busting
 *     - GET / BEACON (or AUTO→beacon): add ?cache=timestamp to URL
 *     - POST/fetch fallback: add no-store request headers
 *   bustCache !== true  -> no cache-busting (default)
 */
export type TransportMethod = 'GET' | 'POST' | 'BEACON' | 'AUTO';

export type TransportRequest = {
  method: TransportMethod;
  url: string;
  headers?: Record<string, string>;
  /** If string, sent verbatim; otherwise JSON-serialized unless GET. */
  body?: unknown;
  /** Beacon payload size guard. If exceeded, we skip beacon and use fetch. */
  maxBeaconBytes?: number;
  /** Optional controller for aborts in the future. */
  signal?: AbortSignal | null;
  /** When true, perform cache-busting (query param for GET/beacon; no-store headers for POST). */
  bustCache?: boolean;
};

export type Sender = {
  type: TransportMode;
  override: boolean;
  send: (req: TransportRequest) => Promise<Response>;
};

/**
 * Wrap the NetworkDispatcher to send per-item.
 * We return a synthetic OK Response so adapter `ok/parseError` logic remains intact.
 */
export function makeDispatcherSender(options: NetworkDispatcherOptions): Sender {
  const dispatcher = new NetworkDispatcher(options);
  const RESPONSE_OK = { ok: true, status: 204, statusText: 'OK' } as unknown as Response;

  return {
    type: options.transportMode,
    override: !!options.transportOverride,
    send: async ({ method, url, headers, body }) => {
      // Respect method nuances only to the extent your dispatcher/resolveTransport supports.
      // Common case: POST/AUTO. For BEACON, resolveTransport will choose beacon when applicable.
      const init: RequestInit = {
        method: method === 'GET' ? 'GET' : 'POST',
        headers,
      };
      await dispatcher.send({ url, body, init });
      return RESPONSE_OK; // no per-event response in batched path
    },
  };
};
