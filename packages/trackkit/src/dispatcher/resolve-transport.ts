import { BeaconTransport, FetchTransport, type Transport } from './transport';

export function resolveTransport(resilience?: {
  detectBlockers?: boolean;
  proxy?: { endpoint: string; token?: string; headers?: Record<string,string>; };
  fallbackStrategy?: 'proxy'|'beacon'|'none';
}): Promise<Transport> | Transport {
  const base = new FetchTransport();

  if (!resilience?.detectBlockers) return base;

  // Lazy detect & choose
  return (async () => {
    const { detectBlockers } = await import('./adblocker');
    const result = await detectBlockers();
    if (!result.blocked) return base;

    switch (resilience.fallbackStrategy || result.fallback || 'proxy') {
      case 'beacon': return new BeaconTransport();
      // For 'proxy' you’d add a ProxiedTransport that posts to your first-party endpoint.
      default:       return base; // supply ProxiedTransport here if implemented
    }
  })();
}