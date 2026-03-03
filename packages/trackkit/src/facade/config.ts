import { readEnvConfig } from '../util/env';
import { AnalyticsError, dispatchError } from '../errors';
import type { AnalyticsOptions, ProviderOptions, ResolvedAnalyticsOptions, ResolvedProviderOptions } from '../types';
import { applyDispatcherDefaults, applyFacadeDefaults } from './normalize';
import { logger } from '../util/logger';
import { DEFAULT_PROVIDER_OPTIONS, GA_HOST, PLAUSIBLE_HOST, UMAMI_HOST } from '../constants';
import { deepMerge } from '../util';


function mergeProviderOptions(
  envProvider?: ProviderOptions,
  userProvider?: ProviderOptions
): ProviderOptions | undefined {
  if (!envProvider && !userProvider) return undefined;
  if (!envProvider) return userProvider;
  if (!userProvider) return envProvider as ProviderOptions;

  if (envProvider.name !== userProvider.name) {
    return userProvider;
  }

  return deepMerge(envProvider, userProvider);
}

export function mergeOptions(env: AnalyticsOptions, user: AnalyticsOptions): AnalyticsOptions {
  const { provider: envProvider, dispatcher: envDispatcher, ...envRest } = env;
  const { provider: userProvider, dispatcher: userDispatcher, ...userRest } = user;

  const mergedFacade = deepMerge(envRest, userRest);
  const mergedDispatcher = deepMerge(envDispatcher, userDispatcher);
  const mergedProvider = mergeProviderOptions(envProvider, userProvider); 

  return {
    // ...FACADE_BASE_DEFAULTS,
    ...mergedFacade,
    dispatcher: mergedDispatcher,
    provider: mergedProvider ?? DEFAULT_PROVIDER_OPTIONS,
  };
}

export function resolveConfig(userOptions: AnalyticsOptions = {}): ResolvedAnalyticsOptions {
  const completeUserOptions = mergeOptions(readEnvConfig(), userOptions);

  const rawProvider = extractProviderOptions(completeUserOptions);
  const dispatcher = applyDispatcherDefaults(completeUserOptions.dispatcher);
  const facade = applyFacadeDefaults(completeUserOptions, rawProvider.name);
  let provider = DEFAULT_PROVIDER_OPTIONS;

  try {
    provider = validateProviderConfig(rawProvider);
  } catch (e) {
    logger.error('Error validating provider config:', e);
    dispatchError(e, 'INVALID_CONFIG', provider.name ?? 'unknown');
  }

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
        defaultProps: provider.defaultProps,
        domain: provider.domain ?? provider.site!,
        host: provider.host ?? PLAUSIBLE_HOST,
        revenue: provider.revenue,
      };
    case 'umami':
      return {
        name: 'umami',
        website: provider.website ?? provider.site!,
        host: provider.host ?? UMAMI_HOST,
      };
    case 'ga4':
      return {
        name: 'ga4',
        measurementId: provider.measurementId ?? provider.site!,
        host: provider.host ?? GA_HOST,
        apiSecret: provider.apiSecret,
        customDimensions: provider.customDimensions,
        customMetrics: provider.customMetrics,
        debugEndpoint: provider.debugEndpoint,
        debugMode: provider.debugMode ?? false,
      };
    case 'noop':
    default:
      return DEFAULT_PROVIDER_OPTIONS;
  }
}

export function validateProviderConfig(providerOptions: ProviderOptions): ResolvedProviderOptions {
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
    dispatchError(new AnalyticsError(
      errorMessage,
      'INVALID_CONFIG',
      name,
    ));
    return DEFAULT_PROVIDER_OPTIONS as ResolvedProviderOptions;
  } else {
    return providerOptions as ResolvedProviderOptions;
  }
}
