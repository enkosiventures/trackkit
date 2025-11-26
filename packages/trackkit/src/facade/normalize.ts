import type { ConsentOptions, ResolvedConsentOptions } from '../consent/types';
import {
  CONSENT_DEFAULTS, RETRY_DEFAULTS, BATCHING_DEFAULTS, CONNECTION_DEFAULTS,
  PERFORMANCE_DEFAULTS, RESILIENCE_DEFAULTS, FACADE_BASE_DEFAULTS
} from '../constants';
import type { ResilienceOptions } from '../dispatcher/transports';
import type { BatchingOptions, ConnectionOptions, PerformanceOptions, RetryOptions } from '../dispatcher/types';
import { getProviderMetadata } from '../providers/metadata';
import type { NavigationSource } from '../types';
import { makeWindowNavigationSource } from './navigation';


export function applyConsentDefaults(options?: ConsentOptions): ResolvedConsentOptions {
  const opts = options ?? {};
  return {
    initialStatus: opts.initialStatus ?? CONSENT_DEFAULTS.initialStatus,
    storageKey: opts.storageKey ?? CONSENT_DEFAULTS.storageKey,
    disablePersistence: opts.disablePersistence ?? CONSENT_DEFAULTS.disablePersistence,
    policyVersion: opts.policyVersion,
    requireExplicit: opts.requireExplicit ?? CONSENT_DEFAULTS.requireExplicit,
    allowEssentialOnDenied: opts.allowEssentialOnDenied ?? CONSENT_DEFAULTS.allowEssentialOnDenied,
  };
}

export function applyRetryDefaults(options?: RetryOptions) {
  const opts = options ?? {};
  return {
    maxAttempts: opts.maxAttempts ?? RETRY_DEFAULTS.maxAttempts,
    initialDelay: opts.initialDelay ?? RETRY_DEFAULTS.initialDelay,
    maxDelay: opts.maxDelay ?? RETRY_DEFAULTS.maxDelay,
    multiplier: opts.multiplier ?? RETRY_DEFAULTS.multiplier,
    jitter: opts.jitter ?? RETRY_DEFAULTS.jitter,
    retryableStatuses: opts.retryableStatuses ?? RETRY_DEFAULTS.retryableStatuses,
  } as const;
}

export function applyBatchingDefaults(options?: Partial<BatchingOptions>) {
  const opts = options ?? {};
  return {
    enabled: opts.enabled ?? BATCHING_DEFAULTS.enabled,
    maxSize: opts.maxSize ?? BATCHING_DEFAULTS.maxSize,
    maxWait: opts.maxWait ?? BATCHING_DEFAULTS.maxWait,
    maxBytes: opts.maxBytes ?? BATCHING_DEFAULTS.maxBytes,
    concurrency: opts.concurrency ?? BATCHING_DEFAULTS.concurrency,
    deduplication: opts.deduplication ?? BATCHING_DEFAULTS.deduplication,
    retry: applyRetryDefaults(opts.retry),
  } as Required<BatchingOptions>;
}

export function applyConnectionDefaults(options?: ConnectionOptions) {
  const opts = options ?? {};
  return {
    monitor: opts.monitor ?? CONNECTION_DEFAULTS.monitor,
    offlineStorage: opts.offlineStorage ?? CONNECTION_DEFAULTS.offlineStorage,
    syncInterval: opts.syncInterval ?? CONNECTION_DEFAULTS.syncInterval,
    slowThreshold: opts.slowThreshold ?? CONNECTION_DEFAULTS.slowThreshold,
    checkInterval: opts.checkInterval ?? CONNECTION_DEFAULTS.checkInterval,
  } as const;
}

export function applyPerformanceDefaults(options?: PerformanceOptions) {
  const opts = options ?? {};
  return {
    enabled: opts.enabled ?? PERFORMANCE_DEFAULTS.enabled,
    sampleRate: opts.sampleRate ?? PERFORMANCE_DEFAULTS.sampleRate,
    windowSize: opts.windowSize ?? PERFORMANCE_DEFAULTS.windowSize,
  } as const;
}

export function applyResilienceDefaults(options?: ResilienceOptions) {
  const opts = options ?? {};
  return {
    detectBlockers: opts.detectBlockers ?? RESILIENCE_DEFAULTS.detectBlockers,
    proxy: opts.proxy ?? RESILIENCE_DEFAULTS.proxy,
    fallbackStrategy: opts.fallbackStrategy ?? RESILIENCE_DEFAULTS.fallbackStrategy,
  } as const;
}

export function applyNavigationSourceDefaults(src?: NavigationSource) {
  return src ?? makeWindowNavigationSource(); // safe default
}

export function applyFacadeDefaults(
  combined: any, // merged env+user, shape: InitOptions
  providerName: 'noop' | 'umami' | 'plausible' | 'ga4'
) {
  const meta = getProviderMetadata(providerName);
  const trackLocalhost =
    combined.trackLocalhost ?? meta?.trackLocalhost ?? FACADE_BASE_DEFAULTS.trackLocalhost;

  return Object.freeze({
    ...FACADE_BASE_DEFAULTS,
    ...combined, // top-level flags like includeHash, etc. (user/env override base)
    trackLocalhost,

    // nested groups normalized through single SRoT helpers
    // consent: applyConsentDefaults(combined.consent),
    batching: applyBatchingDefaults(combined.batching),
    connection: applyConnectionDefaults(combined.connection),
    performance: applyPerformanceDefaults(combined.performance),
    resilience: applyResilienceDefaults(combined.resilience),
    navigationSource: applyNavigationSourceDefaults(combined.navigationSource),
  });
}
