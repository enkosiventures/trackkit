import { FetchTransport } from './fetch';
import { BeaconTransport } from './beacon';
import { ProxiedTransport } from './proxy';
import type { ResilienceOptions, Transport } from '../types';
import { AnalyticsError } from '../../errors';


/**
 * Resolves the appropriate transport based on ad blocker detection and resilience configuration.
 * 
 * Transport selection follows this precedence:
 * 1. If blocker detection is disabled, always use FetchTransport
 * 2. If enabled but no blocker detected, use FetchTransport  
 * 3. If blocker detected, select fallback strategy:
 *    - Uses smart default: 'proxy' if proxy is configured, otherwise 'beacon'
 *    - Honors explicit fallbackStrategy if provided
 *    - Throws error if 'proxy' requested but proxyUrl not configured
 * 
 * @param resilience - Resilience configuration options
 * @returns Transport instance (sync) or Promise<Transport> (when detection enabled)
 * @throws AnalyticsError when proxy strategy requested but proxyUrl not configured
 */
export function resolveTransport(resilience?: ResilienceOptions): Promise<Transport> | Transport {
  const base = new FetchTransport();
  
  if (!resilience?.detectBlockers) return base;

  return (async () => {
    const { detectBlockers } = await import('../adblocker');
    const result = await detectBlockers();

    if (!result.blocked) return base;

    // Smart default: use proxy only if configured, otherwise beacon
    const defaultStrategy = resilience.proxy?.proxyUrl ? 'proxy' : 'beacon';
    const want = resilience.fallbackStrategy ?? result.fallback ?? defaultStrategy;
    
    if (want === 'beacon') return new BeaconTransport();
    if (want === 'none') return base; // Let it fail naturally
    
    // proxy strategy
    if (resilience.proxy?.proxyUrl) {
      return new ProxiedTransport(resilience.proxy);
    }
    
    // Proxy requested but not configured - throw helpful error
    throw new AnalyticsError(
      'Proxy fallback strategy requires resilience.proxy.proxyUrl to be configured',
      'INVALID_CONFIG',
    );
  })();
}
