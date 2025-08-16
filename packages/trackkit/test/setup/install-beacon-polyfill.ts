import { beforeAll, afterAll, afterEach, vi } from 'vitest';

/**
 * Install a minimal sendBeacon polyfill that forwards to fetch so MSW can intercept.
 * Not global by default: call this in integration tests only.
 */
export function installBeaconPolyfill() {
  if (typeof navigator !== 'undefined' && 'sendBeacon' in navigator) return;

  (navigator as any).sendBeacon = (url: string, data?: any) => {
    // Normalise body so fetch actually sends something MSW can intercept.
    let body: BodyInit | undefined;
    let headers: Record<string, string> | undefined;

    if (
      typeof data === 'string' ||
      data instanceof Blob ||
      data instanceof URLSearchParams ||
      data instanceof ArrayBuffer
    ) {
      body = data as BodyInit;
    } else if (data != null) {
      body = JSON.stringify(data);
      headers = { 'content-type': 'application/json' };
    }

    // Fire-and-forget
    fetch(url, {
      method: 'POST',
      body,
      headers,
      keepalive: true,
      credentials: 'omit',
    }).catch(() => { /* swallow in tests */ });

    return true;
  };
}