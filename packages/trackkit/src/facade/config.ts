import { readEnvConfig } from '../util/env';
import { getProviderMetadata } from '../providers/metadata';
import { AnalyticsError } from '../errors';
import type { FacadeOptions, InitOptions, ProviderOptions, ProviderType, ResolvedOptions } from '../types';
import { normalizeProviderOptions } from '../providers/normalize';
import { applyFacadeDefaults } from './normalize';
import { logger } from '../util/logger';


export function extractProviderOptions(options: InitOptions): ProviderOptions {
  switch (options.provider) {
    case 'plausible':
      return {
        provider: 'plausible',
        domain: options.domain ?? options.site!,
        host: options.host,
        revenue: options.revenue,
      };
    case 'umami':
      return {
        provider: 'umami',
        website: options.website ?? options.site!,
        host: options.host,
      };
    case 'ga4':
      return {
        provider: 'ga4',
        measurementId: options.measurementId ?? options.site!,
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

export function mergeConfig(userOptions: InitOptions): ResolvedOptions {
  const env = readEnvConfig();
  const combined = { ...env, ...userOptions };

  const rawProvider = extractProviderOptions(combined);
  const providerOptions = normalizeProviderOptions(rawProvider);

  const facadeOptions = applyFacadeDefaults(combined, providerOptions.provider);
  return { facadeOptions, providerOptions } as const;
}

export function validateProviderConfig({ providerOptions }: ResolvedOptions): void {
  const { provider } = providerOptions;

  let field;
  let errorMessage;
  switch (provider) {
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
      errorMessage = `Unknown provider: ${provider}`;
  }

  if (errorMessage) {
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