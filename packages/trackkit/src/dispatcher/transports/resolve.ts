import { FetchTransport } from './fetch';
import { BeaconTransport } from './beacon';
import { ProxiedTransport } from './proxy';
import type { ResilienceOptions, Transport } from '../types';


export function resolveTransport(resilience?: ResilienceOptions): Promise<Transport> | Transport {
  const base = new FetchTransport();

  // Transport selection precedence:
  // - If detectBlockers is disabled, always use fetch directly.
  // - If enabled and no blockers are detected, still use fetch.
  // - If a blocker is detected:
  //    - honour resilience.fallbackStrategy when set, otherwise use the
  //      detector's suggested fallback, defaulting to 'proxy'.
  //    - 'beacon' → use BeaconTransport.
  //    - 'proxy'  → use ProxiedTransport when proxyUrl is configured,
  //                 otherwise fall back to BeaconTransport.
  if (!resilience?.detectBlockers) return base;

  return (async () => {
    const { detectBlockers } = await import('../adblocker');
    const result = await detectBlockers();

    if (!result.blocked) return base;

    const want = resilience.fallbackStrategy ?? result.fallback ?? 'proxy';
    if (want === 'beacon') return new BeaconTransport();

    // prefer proxy when configured; otherwise fall back to beacon
    if (resilience.proxy?.proxyUrl) {
      return new ProxiedTransport(resilience.proxy);
    }
    return new BeaconTransport();
  })();
}
