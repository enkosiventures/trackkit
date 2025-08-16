import type { ConsentCategory } from "./consent/types";
import type { AnalyticsError } from "./errors";
import type { ProviderOptions, ProviderType } from "./types";
import { logger } from "./util/logger";

export const STORAGE_KEY = '__trackkit_consent__';

export const DEFAULT_PROVIDER: ProviderType = 'noop';
export const DEFAULT_PROVIDER_OPTIONS: ProviderOptions = { provider: DEFAULT_PROVIDER }
export const DEFAULT_QUEUE_SIZE = 50;
export const DEFAULT_BATCH_SIZE = 10;
export const DEFAULT_BATCH_TIMEOUT = 1000;
export const DEFAULT_CACHING = true;
export const DEFAULT_ERROR_HANDLER = (error: AnalyticsError) => {
    logger.error('Analytics error:', error);
  }

export const DEFAULT_CATEGORY: ConsentCategory = 'analytics';
export const ESSENTIAL_CATEGORY: ConsentCategory = 'essential';

export const UMAMI_HOST = 'https://api.umami.is';
export const UMAMI_ENDPOINT = '/api/send';
export const PLAUSIBLE_HOST = 'https://plausible.io';
export const GA_HOST = 'https://www.google-analytics.com';