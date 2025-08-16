import { readEnvConfig, parseEnvBoolean, parseEnvNumber } from '../util/env';
import { getProviderMetadata } from '../providers/metadata';
import { AnalyticsError } from '../errors';
import type { FacadeOptions, InitOptions, ProviderOptions, ProviderType, ResolvedOptions } from '../types';
import { DEFAULT_BATCH_SIZE, DEFAULT_BATCH_TIMEOUT, DEFAULT_CACHING, DEFAULT_ERROR_HANDLER, DEFAULT_QUEUE_SIZE } from '../constants';
import { error } from 'console';
import { debugLog, logger } from '../util/logger';
import { UmamiOptions } from '../providers/new/umami';

const FACADE_DEFAULTS: FacadeOptions = {
  queueSize: DEFAULT_QUEUE_SIZE,
  batchSize: DEFAULT_BATCH_SIZE,
  batchTimeout: DEFAULT_BATCH_TIMEOUT,
  debug: false,
  autoTrack: true,
  doNotTrack: true,
  trackLocalhost: undefined as any, // handled via provider meta fallback
  cache: DEFAULT_CACHING,
  allowWhenHidden: false,
  includeHash: false,
  transport: 'auto',
  onError: DEFAULT_ERROR_HANDLER,
};

/** Type guards (handy inside config/validation). */
// export const isUmami = (o: AnalyticsOptions): o is FacadeOptions & UmamiOptions => o.provider === 'umami';
// export const isPlausible = (o: AnalyticsOptions): o is FacadeOptions & Plausi => o.provider === 'plausible';
// export const isGA4 = (o: AnalyticsOptions): o is FacadeOptions & GA4Options => o.provider === 'ga4';


// function normalizedProvider(options: AnalyticsOptions) {
//   if (isPlausible(options)) {
//     return { provider: 'plausible' as const, domain: options.domain ?? options.site, host: options.host, revenue: options.revenue };
//   }
//   if (isUmami(options)) {
//     return { provider: 'umami' as const, website: options.website ?? options.site!, host: options.host };
//   }
//   if (isGA4(options)) {
//     return { provider: 'ga4' as const, measurementId: options.measurementId ?? options.site!, host: options.host,
//              apiSecret: options.apiSecret, customDimensions: options.customDimensions, customMetrics: options.customMetrics };
//   }
//   return { provider: 'noop' as const };
// }

// function normalizeSiteAlias(opts: AnalyticsOptions): ProviderOptions {
//   const p = opts.provider ?? 'noop';
//   if (p === 'plausible') return { provider: 'plausible', domain: opts.domain ?? opts.site! , host: opts.host, revenue: opts.revenue };
//   if (p === 'umami')     return { provider: 'umami',     website: opts.website ?? opts.site!, host: opts.host };
//   if (p === 'ga4')       return { provider: 'ga4',       measurementId: opts.measurementId ?? opts.site!, host: opts.host, apiSecret: opts.apiSecret, customDimensions: opts.customDimensions, customMetrics: opts.customMetrics };
//   return { provider: 'noop' };
// }

function extractProviderOptions(options: InitOptions): ProviderOptions {
  switch (options.provider) {
    case 'plausible':
      return {
        provider: 'plausible',
        domain: options.domain || options.site!,
        host: options.host,
        revenue: options.revenue,
      };
    case 'umami':
      return {
        provider: 'umami',
        website: options.website || options.site!,
        host: options.host
      };
    case 'ga4':
      return {
        provider: 'ga4',
        measurementId: options.measurementId || options.site!,
        host: options.host,
        apiSecret: options.apiSecret,
        customDimensions: options.customDimensions,
        customMetrics: options.customMetrics,
        debugEndpoint: options.debugEndpoint,
        debugMode: options.debugMode,
      };
    default:
      return { provider: 'noop' };
  }
}

// export function mergeConfig(options: AnalyticsOptions): AnalyticsOptions {
//   const envConfig = readEnvConfig();
//   const config = {
//     ...DEFAULT_OPTIONS,
//     ...envConfig,
//     ...options,
//   };
//   return {
//     ...config,
//     ...normalizeSite(config),
//   };
// }

export function mergeConfig(userOptions: InitOptions): ResolvedOptions {
  const env = readEnvConfig();
  const combined = { ...env, ...userOptions };
  const providerOptions = extractProviderOptions(combined);

  // Fill facade defaults
  const facadeOptions: ResolvedOptions['facadeOptions'] = {
    ...FACADE_DEFAULTS,
    ...combined, // user/env override
  };

  // trackLocalhost default via provider meta if not explicitly set
  const meta = getProviderMetadata(providerOptions.provider ?? 'noop');
  const allowLocalhostDefault = meta?.trackLocalhost ?? true;
  if (facadeOptions.trackLocalhost === undefined) {
    facadeOptions.trackLocalhost = allowLocalhostDefault;
  }

  return { facadeOptions, providerOptions };
}

export function validateConfig({ providerOptions }: ResolvedOptions): void {
  const { provider, site } = providerOptions;

  let field;
  let errorMessage;
  switch (provider) {
    case 'plausible':
      field = site ? 'site' : 'domain';
      if (!providerOptions.domain) {
        errorMessage = "Plausible requires a domain to be provided (using either 'domain' or 'site' option)";
      } else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(providerOptions.domain)) {
        errorMessage = `Plausible provider requires a ${field} in a valid domain format`;
      }
      break;
    case 'umami':
      field = site ? 'site' : 'website';
      if (!providerOptions.website) {
        errorMessage = "Umami requires a website to be provided (using either 'website' or 'site' option)";
      } else if (!/^[0-9a-f-]{36}$/i.test(providerOptions.website)) {
        errorMessage = `Umami provider requires a ${field} in a valid UUID format`;
      }
      break;
    case 'ga4':
      field = site ? 'site' : 'measurementId';
      if (!providerOptions.measurementId) {
        errorMessage = "Google Analytics 4 requires a measurementId to be provided (using either 'measurementId' or 'site' option)";
      } else if (!/^G-[A-Z0-9]{6,}$/.test(providerOptions.measurementId)) {
        errorMessage = `Google Analytics 4 provider requires a ${field} in a valid format (e.g. 'G-XXXXXXXXXX')`;
      }
      break;
    case 'noop':
      break;
    default:
      errorMessage = `Unknown provider: ${provider}`;
  }

  if (errorMessage) {
    debugLog(`Invalid config: ${errorMessage}`);
    logger.error(`Invalid config: ${errorMessage}`);
    throw new AnalyticsError(
      errorMessage,
      'INVALID_CONFIG',
      provider
    );
  }
}

export function getConsentConfig(
  facadeOptions: FacadeOptions | null,
  provider?: ProviderType,
): Record<string, unknown> {
  const providerMeta = getProviderMetadata(provider);

  return {
    ...providerMeta?.consentDefaults,
    ...facadeOptions?.consent,
  };
}