import type { ConsentCategory, ConsentOptions, ResolvedConsentOptions } from "./consent/types";
import type { BatchingOptions, ConnectionOptions, PerformanceOptions, RetryOptions } from "./dispatcher/types";
import type { AnalyticsError } from "./errors";
import type { FacadeOptions, ProviderOptions, ProviderType } from "./types";
import { logger } from "./util/logger";

export const STORAGE_KEY = '__trackkit_consent__';

export const DEFAULT_PROVIDER: ProviderType = 'noop';
export const DEFAULT_PROVIDER_OPTIONS: ProviderOptions = { provider: DEFAULT_PROVIDER }
export const DEFAULT_PRE_INIT_BUFFER_SIZE = 50;
export const DEFAULT_ERROR_HANDLER = (error: AnalyticsError) => {
    logger.error('Analytics error:', error);
  }

export const DEFAULT_CATEGORY: ConsentCategory = 'analytics';
export const ESSENTIAL_CATEGORY: ConsentCategory = 'essential';

export const UMAMI_ENDPOINT = '/api/send';
export const UMAMI_HOST = 'https://api.umami.is';
export const PLAUSIBLE_HOST = 'https://plausible.io';
export const GA_HOST = 'https://www.google-analytics.com';

export const RETRY_DEFAULTS: RetryOptions = {
  maxAttempts: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  multiplier: 2,
  jitter: true,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
} as const;

export const BATCHING_DEFAULTS: BatchingOptions = {
  enabled: false,
  maxSize: 10,
  maxWait: 1000,
  maxBytes: 64 * 1024,
  concurrency: 2,
  deduplication: true,
} as const;

export const CONNECTION_DEFAULTS: ConnectionOptions = {
  monitor: false,
  offlineStorage: false,
  syncInterval: 30000,
  slowThreshold: 3000,
  checkInterval: 30000,
} as const;

export const PERFORMANCE_DEFAULTS: PerformanceOptions = {
  enabled: false,
  sampleRate: undefined as number | undefined,
  logSummaryInterval: undefined as number | undefined,
} as const;

export const RESILIENCE_DEFAULTS = {
  detectBlockers: false,
  fallbackStrategy: 'proxy' as const, // 'proxy' | 'beacon' | 'none'
  proxy: undefined as
    | { endpoint: string; token?: string; headers?: Record<string, string> }
    | undefined,
} as const;

export const CONSENT_DEFAULTS: ResolvedConsentOptions = {
  initialStatus: 'pending',
  requireExplicit: true,
  allowEssentialOnDenied: false,
  disablePersistence: false,
  storageKey: STORAGE_KEY,
} as const satisfies Readonly<
  Pick<Required<ConsentOptions>, 'initialStatus' | 'requireExplicit' | 'allowEssentialOnDenied' | 'disablePersistence' | 'storageKey'>
>

export const FACADE_BASE_DEFAULTS: FacadeOptions = {
  allowWhenHidden: false,
  autoTrack: true,
  batchSize: 10,
  batchTimeout: 1000,
  bustCache: true,
  debug: false,
  doNotTrack: true,
  includeHash: false,
  queueSize: 50,
  trackLocalhost: true,
  transport: 'auto',
  onError: DEFAULT_ERROR_HANDLER,
} as const;