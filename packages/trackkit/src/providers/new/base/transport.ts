import { debugLog } from "../../../util/logger";
import { stripEmptyFields } from "../../shared/utils";

/**
 * Shared transport layer used by all providers.
 * - Uses navigator.sendBeacon when possible (optional size guard)
 * - Falls back to fetch with keepalive
 * - Centralizes headers/body serialization
 *
 * Cache behavior:
 *   cache === true  -> enable cache-busting
 *     - GET / BEACON (or AUTO→beacon): add ?cache=timestamp to URL
 *     - POST/fetch fallback: add no-store request headers
 *   cache !== true  -> no cache-busting (default)
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
  cache?: boolean;
};

function appendCacheParam(url: string): string {
  // Robust even for absolute URLs; falls back to string concat if URL ctor fails.
  try {
    const base = typeof window !== 'undefined' ? window.location.origin : 'http://localhost';
    const u = new URL(url, base);
    u.searchParams.set('cache', String(Date.now()));
    return u.toString().replace(/^https?:\/\/[^/]+/, ''); // keep as path if same-origin
  } catch {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}cache=${Date.now()}`;
  }
}

export async function send(req: TransportRequest): Promise<Response> {
  const { method, url, body, maxBeaconBytes, signal } = req;

  const canBeacon =
    typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';

  // Will we *attempt* beacon? (AUTO prefers beacon if available)
  const wantBeacon = method === 'BEACON' || (method === 'AUTO' && canBeacon);

  // Enable cache-busting when req.cache === true
  const bustCache = req.cache === true;

  // Decide final URL: add ?cache=... for GET or when we intend to use beacon.
  // Note: if we later fall back from beacon→fetch due to size, the query param is harmless.
  console.warn('Want beacon:', wantBeacon, 'bustCache:', bustCache, 'method:', method);
  const finalUrl =
    bustCache && (method === 'GET' || wantBeacon) ? appendCacheParam(url) : url;

  const strippedBody = stripEmptyFields(body);

  // Headers: only meaningful for fetch; beacon ignores headers.
  const headers = {
    'content-type': 'application/json',
    ...(bustCache && method !== 'GET' && !wantBeacon
      ? { 'Cache-Control': 'no-store, max-age=0', Pragma: 'no-cache' }
      : {}),
    ...(req.headers || {}),
  };

  debugLog('Transport.send', {
    method,
    url: finalUrl,
    headers,
    body: strippedBody,
    maxBeaconBytes,
    signal: req.signal ? 'exists' : 'none',
    cacheBust: bustCache,
    wantBeacon,
  });
  debugLog('Transport.body', strippedBody);

  // Prepare payload
  const serialized =
    typeof strippedBody === 'string'
      ? strippedBody
      : strippedBody == null
      ? ''
      : JSON.stringify(strippedBody);

  // Try beacon when requested and within size limits
  if (wantBeacon && canBeacon) {
    const within = !maxBeaconBytes || serialized.length <= maxBeaconBytes;
    if (within) {
      const blob = new Blob([serialized], { type: 'application/json' });
      const ok = navigator.sendBeacon(finalUrl, blob);
      if (ok) {
        // sendBeacon has no response; pretend 204 so callers can treat it as success
        return new Response(null, { status: 204, statusText: 'No Content (beacon)' });
      }
      // If sendBeacon returns false, fall through to fetch
    }
  }

  // Fetch (primary or fallback)
  const useMethod = method === 'GET' ? 'GET' : 'POST';
  const init: RequestInit = {
    method: useMethod,
    headers,
    body: useMethod === 'GET' ? undefined : serialized,
    keepalive: true,
    signal: signal ?? undefined,
  };

  debugLog('Transport.fetch');
  return fetch(finalUrl, init);
}
