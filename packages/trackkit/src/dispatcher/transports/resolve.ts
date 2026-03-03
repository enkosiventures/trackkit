import { NoopTransport } from './noop';
import { FetchTransport } from './fetch';
import { BeaconTransport } from './beacon';
import { ProxiedTransport } from './proxy';
import type { ResilienceOptions, Transport, TransportMode } from '../types';
import { AnalyticsError } from '../../errors';
import { logger } from '../../util/logger';
import { detectBlockers } from '../adblocker';


async function smartTransportResolution(resilience?: ResilienceOptions) {
  const base = new FetchTransport();

  if (!resilience?.detectBlockers) return base;

  const result = await detectBlockers();
  if (!result.blocked) return base;

  // We’re in “blocked” territory
  const hasProxy = !!resilience.proxy?.proxyUrl;
  const hinted = result.fallback; // 'proxy' | 'beacon' | 'none' | undefined

  // Smart default: prefer proxy if configured, else beacon
  const smartDefault: TransportMode = hasProxy ? 'proxy' : 'beacon';

  // Honour explicit fallbackStrategy, but never choose proxy without a URL
  let want = resilience.fallbackStrategy ?? hinted ?? smartDefault;

  if (want === 'proxy' && !hasProxy) {
    // Smart mode: downgrade, don’t throw
    logger.warn(
      '[dispatcher] fallbackStrategy="proxy" configured without resilience.proxy.proxyUrl; falling back to beacon'
    );
    want = 'beacon';
  }

  if (want === 'beacon') return new BeaconTransport();
  if (want === 'proxy') return new ProxiedTransport(resilience.proxy!);
  return base;
}

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
export async function resolveTransport(
  mode: TransportMode,
  resilience?: ResilienceOptions
): Promise<Transport> {
  switch (mode) {
    case 'noop':
      return new NoopTransport();
    case 'fetch':
      return new FetchTransport();
    case 'beacon':
      return new BeaconTransport();
    case 'proxy':
      if (resilience?.proxy?.proxyUrl) {
        return new ProxiedTransport(resilience.proxy);
      }
      throw new AnalyticsError(
        'Proxy transport requires resilience.proxy.proxyUrl to be configured',
        'INVALID_CONFIG',
      );
    case 'smart':
    default:
      return smartTransportResolution(resilience);
  }
}
