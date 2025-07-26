import { readEnvConfig, parseEnvBoolean, parseEnvNumber } from '../util/env';
import { getProviderMetadata } from '../providers/metadata';
import { AnalyticsError } from '../errors';
import type { AnalyticsOptions, ProviderType } from '../types';
import { DEFAULT_BATCH_SIZE, DEFAULT_BATCH_TIMEOUT, DEFAULT_QUEUE_SIZE } from '../constants';

const DEFAULT_OPTIONS = {
  provider: 'noop' as ProviderType,
  queueSize: DEFAULT_QUEUE_SIZE,
  debug: false,
  batchSize: DEFAULT_BATCH_SIZE,
  batchTimeout: DEFAULT_BATCH_TIMEOUT,
};

export function mergeConfig(options: AnalyticsOptions): AnalyticsOptions {
  const envConfig = readEnvConfig();
  
  return {
    ...DEFAULT_OPTIONS,
    provider: (envConfig.provider || options.provider || DEFAULT_OPTIONS.provider) as ProviderType,
    siteId: envConfig.siteId || options.siteId,
    host: envConfig.host || options.host,
    queueSize: parseEnvNumber(envConfig.queueSize, options.queueSize || DEFAULT_OPTIONS.queueSize),
    debug: parseEnvBoolean(envConfig.debug, options.debug || DEFAULT_OPTIONS.debug),
    ...options,
  };
}

export function validateConfig(config: AnalyticsOptions): void {
  const VALID_PROVIDERS: ProviderType[] = ['noop', 'umami', 'plausible', 'ga'];
  if (!VALID_PROVIDERS.includes(config.provider as ProviderType)) {
    throw new AnalyticsError(
      `Unknown provider: ${config.provider}`,
      'INVALID_CONFIG',
      config.provider
    );
  }
  
  // Provider-specific validation
  if (config.provider === 'umami' && !config.siteId) {
    throw new AnalyticsError(
      'Umami provider requires a siteId',
      'INVALID_CONFIG',
      'umami'
    );
  }
}

export function getConsentConfig(config: AnalyticsOptions) {
  const providerMeta = getProviderMetadata(config.provider as string);
  
  return {
    ...providerMeta?.consentDefaults,
    ...config.consent,
  };
}