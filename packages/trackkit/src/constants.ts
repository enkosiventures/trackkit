import type { ConsentCategory, ResolvedConsentOptions } from "./consent/types";
import type { AnalyticsError } from "./errors";
import type { FacadeOptions, ProviderOptions, ProviderType, ResolvedFacadeOptions, ResolvedProviderOptions } from "./types";
import type { 
  FallbackStrategy, ResolvedBatchingOptions, ResolvedConnectionOptions,
  ResolvedPerformanceOptions, ResolvedResilienceOptions, ResolvedRetryOptions,
  TransportMode,
} from "./dispatcher/types";

import { logger } from "./util/logger";
import { makeWindowNavigationSource } from "./facade/navigation";


export const STORAGE_KEY = '__trackkit_consent__';

export const DEFAULT_PROVIDER: ProviderType = 'noop';
export const DEFAULT_PROVIDER_OPTIONS: ResolvedProviderOptions = { name: DEFAULT_PROVIDER }
export const DEFAULT_NAVIGATION_SOURCE = makeWindowNavigationSource();
export const DEFAULT_ERROR_HANDLER = (error: AnalyticsError) => {
    logger.error('Analytics error:', error);
  }

export const DEFAULT_CATEGORY: ConsentCategory = 'analytics';
export const ESSENTIAL_CATEGORY: ConsentCategory = 'essential';

export const UMAMI_ENDPOINT = '/api/send';
export const UMAMI_HOST = 'https://api.umami.is';
export const PLAUSIBLE_HOST = 'https://plausible.io';
export const GA_HOST = 'https://www.google-analytics.com';

export const DEFAULT_TRANSPORT_MODE: TransportMode = 'smart';
export const DEFAULT_HEADERS = {};

export const RETRY_DEFAULTS: ResolvedRetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
} as const;

export const BATCHING_DEFAULTS: ResolvedBatchingOptions = {
  enabled: false,
  maxSize: 10,
  maxWait: 1000,
  maxBytes: 64 * 1024,
  concurrency: 2,
  deduplication: true,
} as const;

export const CONNECTION_DEFAULTS: ResolvedConnectionOptions = {
  monitor: false,
  offlineStorage: false,
  syncInterval: 30000,
  slowThreshold: 3000,
  checkInterval: 30000,
} as const;

export const PERFORMANCE_DEFAULTS: ResolvedPerformanceOptions = {
  enabled: false,
  sampleRate: 1,
  windowSize: 100,
} as const;

export const RESILIENCE_DEFAULTS: ResolvedResilienceOptions = {
  detectBlockers: false,
  fallbackStrategy: 'proxy' as FallbackStrategy,
  proxy: undefined as
    | { proxyUrl: string; token?: string; headers?: Record<string, string> }
    | undefined,
  retry: RETRY_DEFAULTS,
} as const;

export const CONSENT_DEFAULTS: ResolvedConsentOptions = {
  initialStatus: 'pending',
  requireExplicit: true,
  allowEssentialOnDenied: false,
  disablePersistence: false,
  storageKey: STORAGE_KEY,
} as const;

export const FACADE_BASE_DEFAULTS: ResolvedFacadeOptions = {
  allowWhenHidden: false,
  autoTrack: true,
  bustCache: false,
  debug: false,
  domains: [],
  doNotTrack: true,
  exclude: [],
  includeHash: false,
  queueSize: 50,
  trackLocalhost: false,
  consent: CONSENT_DEFAULTS,
  navigationSource: DEFAULT_NAVIGATION_SOURCE,
  onError: DEFAULT_ERROR_HANDLER,
} as const;

export const PROVIDER_BASE_DEFAULTS = {
  consent: {
    requireExplicit: true,
    supportsEssential: false,
    defaultMode: 'opt-in' as const,
    categories: ['analytics'] as const,
  },
  trackLocalhost: false, // Safe default for real providers
} as const;

export const PROVIDER_DEFAULTS = {
  noop: {
    ...PROVIDER_BASE_DEFAULTS,
    consent: {
      ...PROVIDER_BASE_DEFAULTS.consent,
      supportsEssential: true,
      defaultMode: 'essential-only' as const,
      categories: ['essential'] as const,
    },
    trackLocalhost: true, // Override for testing provider
  },
  umami: PROVIDER_BASE_DEFAULTS,
  plausible: PROVIDER_BASE_DEFAULTS,
  ga4: {
    ...PROVIDER_BASE_DEFAULTS,
    consent: {
      ...PROVIDER_BASE_DEFAULTS.consent,
      categories: ['analytics', 'marketing'] as const,
    },
  },
} as const;
