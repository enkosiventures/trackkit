import type { ConsentOptions, ResolvedConsentOptions } from '../consent/types';
import {
  CONSENT_DEFAULTS, RETRY_DEFAULTS, BATCHING_DEFAULTS, CONNECTION_DEFAULTS,
  PERFORMANCE_DEFAULTS, RESILIENCE_DEFAULTS, FACADE_BASE_DEFAULTS,
  DEFAULT_HEADERS,
  PROVIDER_DEFAULTS,
  PROVIDER_BASE_DEFAULTS
} from '../constants';
import type { ResilienceOptions } from '../dispatcher/transports';
import type { BatchingOptions, ConnectionOptions, DispatcherOptions, PerformanceOptions, ResolvedBatchingOptions, ResolvedConnectionOptions, ResolvedDispatcherOptions, ResolvedPerformanceOptions, ResolvedResilienceOptions, ResolvedRetryOptions, RetryOptions } from '../dispatcher/types';
import type { AnalyticsOptions, NavigationSource, ProviderType, ResolvedFacadeOptions, ResolvedNavigationSource } from '../types';
import { makeWindowNavigationSource } from './navigation';


export const applyConsentDefaults = (options: ConsentOptions = {}): ResolvedConsentOptions => ({
  initialStatus: options.initialStatus ?? CONSENT_DEFAULTS.initialStatus,
  storageKey: options.storageKey ?? CONSENT_DEFAULTS.storageKey,
  disablePersistence: options.disablePersistence ?? CONSENT_DEFAULTS.disablePersistence,
  policyVersion: options.policyVersion,
  requireExplicit: options.requireExplicit ?? CONSENT_DEFAULTS.requireExplicit,
  allowEssentialOnDenied: options.allowEssentialOnDenied ?? CONSENT_DEFAULTS.allowEssentialOnDenied,
} as const);

export const applyRetryDefaults = (options: RetryOptions = {}): ResolvedRetryOptions => ({
  maxAttempts: options.maxAttempts ?? RETRY_DEFAULTS.maxAttempts,
  initialDelay: options.initialDelay ?? RETRY_DEFAULTS.initialDelay,
  maxDelay: options.maxDelay ?? RETRY_DEFAULTS.maxDelay,
  multiplier: options.multiplier ?? RETRY_DEFAULTS.multiplier,
  jitter: options.jitter ?? RETRY_DEFAULTS.jitter,
  retryableStatuses: options.retryableStatuses ?? RETRY_DEFAULTS.retryableStatuses,
} as const);


export const applyBatchingDefaults = (options: Partial<BatchingOptions> = {}): ResolvedBatchingOptions => ({
  enabled: options.enabled ?? BATCHING_DEFAULTS.enabled,
  maxSize: options.maxSize ?? BATCHING_DEFAULTS.maxSize,
  maxWait: options.maxWait ?? BATCHING_DEFAULTS.maxWait,
  maxBytes: options.maxBytes ?? BATCHING_DEFAULTS.maxBytes,
  concurrency: options.concurrency ?? BATCHING_DEFAULTS.concurrency,
  deduplication: options.deduplication ?? BATCHING_DEFAULTS.deduplication,
} as const);

export const applyConnectionDefaults = (options: ConnectionOptions = {}): ResolvedConnectionOptions => ({
    monitor: options.monitor ?? CONNECTION_DEFAULTS.monitor,
    offlineStorage: options.offlineStorage ?? CONNECTION_DEFAULTS.offlineStorage,
    syncInterval: options.syncInterval ?? CONNECTION_DEFAULTS.syncInterval,
    slowThreshold: options.slowThreshold ?? CONNECTION_DEFAULTS.slowThreshold,
    checkInterval: options.checkInterval ?? CONNECTION_DEFAULTS.checkInterval,
} as const);

export const applyPerformanceDefaults = (options: PerformanceOptions = {}): ResolvedPerformanceOptions => ({
    enabled: options.enabled ?? PERFORMANCE_DEFAULTS.enabled,
    sampleRate: options.sampleRate ?? PERFORMANCE_DEFAULTS.sampleRate,
    windowSize: options.windowSize ?? PERFORMANCE_DEFAULTS.windowSize,
  } as const);

export const applyResilienceDefaults = (options: ResilienceOptions = {}): ResolvedResilienceOptions => ({
  detectBlockers: options.detectBlockers ?? RESILIENCE_DEFAULTS.detectBlockers,
  fallbackStrategy: options.fallbackStrategy ?? RESILIENCE_DEFAULTS.fallbackStrategy,
  proxy: options.proxy ?? RESILIENCE_DEFAULTS.proxy,
  retry: applyRetryDefaults(options.retry),
} as const);

export const applyNavigationSourceDefaults = (src?: NavigationSource): ResolvedNavigationSource => src ?? makeWindowNavigationSource();

export const applyDispatcherDefaults = (combined: DispatcherOptions = {}): ResolvedDispatcherOptions => ({
  defaultHeaders: combined.defaultHeaders ?? DEFAULT_HEADERS,
  batching: applyBatchingDefaults(combined.batching),
  connection: applyConnectionDefaults(combined.connection),
  performance: applyPerformanceDefaults(combined.performance),
  resilience: applyResilienceDefaults(combined.resilience),
} as const);


export function applyFacadeDefaults(
  combined: AnalyticsOptions, // merged env+user
  providerName: ProviderType,
): ResolvedFacadeOptions {
  const providerDefaults = PROVIDER_DEFAULTS[providerName] || PROVIDER_BASE_DEFAULTS;
  const trackLocalhost =
    combined.trackLocalhost ?? providerDefaults.trackLocalhost ?? FACADE_BASE_DEFAULTS.trackLocalhost;

  return {
    ...FACADE_BASE_DEFAULTS,
    ...combined, // top-level flags like includeHash, etc. (user/env override base)
    trackLocalhost,

    // nested groups normalized through single SRoT helpers
    consent: applyConsentDefaults({ ...providerDefaults.consent, ...combined.consent }),
    navigationSource: applyNavigationSourceDefaults(combined.navigationSource),
  } as const;
}
