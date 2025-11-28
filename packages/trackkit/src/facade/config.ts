import { readEnvConfig } from '../util/env';
import { AnalyticsError } from '../errors';
import type { AnalyticsOptions, ProviderOptions, ResolvedAnalyticsOptions } from '../types';
import { normalizeProviderOptions } from '../providers/normalize';
import { applyDispatcherDefaults, applyFacadeDefaults } from './normalize';
import { logger } from '../util/logger';
import { DEFAULT_PROVIDER_OPTIONS } from '../constants';
import { deepMerge } from '../util';


function mergeOptions(env: AnalyticsOptions, user: AnalyticsOptions): AnalyticsOptions {
  const { provider: envProvider, ...envRest } = env;
  const { provider: userProvider, ...userRest } = user;

  const mergedRest = deepMerge(envRest, userRest);

  return {
    ...mergedRest,
    provider: userProvider ?? envProvider ?? DEFAULT_PROVIDER_OPTIONS,
  };
}

export function resolveConfig(userOptions: AnalyticsOptions = {}): ResolvedAnalyticsOptions {
  const env = readEnvConfig();
  const combined = mergeOptions(env, userOptions);

  const rawProvider = extractProviderOptions(combined);
  const provider = normalizeProviderOptions(rawProvider);
  const dispatcher = applyDispatcherDefaults(combined.dispatcher);
  const facade = applyFacadeDefaults(combined, provider.name);
  
  return { facade, provider, dispatcher } as const;
}

export function extractProviderOptions(options: AnalyticsOptions): ProviderOptions {
  const provider = options.provider;
  
  // Handle missing provider gracefully
  if (!provider) {
    return DEFAULT_PROVIDER_OPTIONS;
  }
  
  switch (provider.name) {
    case 'plausible':
      return {
        name: 'plausible',
        domain: provider.domain ?? provider.site!,
        host: provider.host,
        revenue: provider.revenue,
      };
    case 'umami':
      return {
        name: 'umami',
        website: provider.website ?? provider.site!,
        host: provider.host,
      };
    case 'ga4':
      return {
        name: 'ga4',
        measurementId: provider.measurementId ?? provider.site!,
        host: provider.host,
        apiSecret: provider.apiSecret,
        customDimensions: provider.customDimensions,
        customMetrics: provider.customMetrics,
        debugEndpoint: provider.debugEndpoint,
        debugMode: provider.debugMode,
      };
    case 'noop':
    default:
      return DEFAULT_PROVIDER_OPTIONS;
  }
}

export function validateProviderConfig(providerOptions: ProviderOptions): void {
  const { name } = providerOptions;

  let field;
  let errorMessage;
  switch (name) {
    case 'plausible':
      field = 'domain';
      if (!providerOptions.domain) {
        errorMessage = "Plausible requires a domain to be provided (using either 'domain' or 'site' option)";
      } else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(providerOptions.domain)) {
        errorMessage = `Plausible provider requires a 'site' or '${field}' in a valid domain format`;
      }
      break;
    case 'umami':
      field = 'website';
      if (!providerOptions.website) {
        errorMessage = "Umami requires a website to be provided (using either 'website' or 'site' option)";
      } else if (!/^[0-9a-f-]{36}$/i.test(providerOptions.website)) {
        errorMessage = `Umami provider requires a 'site' or '${field}' in a valid UUID format`;
      }
      break;
    case 'ga4':
      field = 'measurementId';
      if (!providerOptions.measurementId) {
        errorMessage = "Google Analytics 4 requires a measurementId to be provided (using either 'measurementId' or 'site' option)";
      } else if (!/^G-[A-Z0-9]{6,}$/.test(providerOptions.measurementId)) {
        errorMessage = `Google Analytics 4 provider requires a 'site' or '${field}' in a valid format (e.g. 'G-XXXXXXXXXX')`;
      }
      break;
    case 'noop':
      break;
    default:
      errorMessage = `Unknown provider: ${name}`;
  }

  if (errorMessage) {
    logger.error(`Invalid config: ${errorMessage}`);
    throw new AnalyticsError(
      errorMessage,
      'INVALID_CONFIG',
      name,
    );
  }
}
