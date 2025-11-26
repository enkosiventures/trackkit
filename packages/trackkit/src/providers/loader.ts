import type { ProviderType, ProviderOptions } from '../types';
import { StatefulProvider } from './stateful-wrapper';
import { providers } from './registry';
import { logger } from '../util/logger';
import type { AnalyticsError } from '../errors';
import { DEFAULT_ERROR_HANDLER, DEFAULT_PROVIDER, DEFAULT_PROVIDER_OPTIONS } from '../constants';
import { makeDispatcherSender } from './base/transport';
import type { NetworkDispatcherOptions, ResilienceOptions } from '../dispatcher';
import type { BatchingOptions } from '../dispatcher/types';
import { applyBatchingDefaults, applyResilienceDefaults } from '../facade/normalize';
import type { PerformanceTracker } from '../performance/tracker';


/**
 * Registry of available providers
 * @internal
 */
const providerRegistry = new Map(
  Object.entries(providers).map(([name, loader]) => [name as ProviderType, loader])
);

type ProviderLoaderOptions = {
  providerOptions: ProviderOptions | null;
  batchingOptions?: BatchingOptions;
  resilienceOptions?: ResilienceOptions;
  bustCache?: boolean;
  debug?: boolean;
  performanceTracker?: PerformanceTracker | null;
  onError?: (error: AnalyticsError) => void;
};

export async function loadProvider(
  loaderOptions?: ProviderLoaderOptions,
): Promise<StatefulProvider> {
  const {
    providerOptions,
    batchingOptions,
    resilienceOptions,
    bustCache,
    debug,
    performanceTracker,
    onError = DEFAULT_ERROR_HANDLER,
  } = loaderOptions || {};
  const options = providerOptions || DEFAULT_PROVIDER_OPTIONS;
  const batching = applyBatchingDefaults(batchingOptions);
  const resilience = applyResilienceDefaults(resilienceOptions);

  // alias GA → GA4 (common config name)
  const name = options.provider ?? DEFAULT_PROVIDER;
  logger.debug('Loading provider:', name);

  const loader = providerRegistry.get(name);
  if (!loader) {
    const msg = `Unknown analytics provider: ${name}`;
    logger.error(msg);
    throw new Error(msg);
  }

  try {
    // Call exactly once – handle both sync & async
    const loaded = loader();  // Promise | Factory
    const factory = loaded instanceof Promise ? await loaded : loaded;

    if (!factory || typeof factory.create !== 'function') {
      const msg = `Invalid provider factory for: ${name}`;
      logger.error(msg);
      throw new Error(msg);
    }

    const sender = makeDispatcherSender({
      batching,
      resilience,
      performanceTracker,
    } satisfies NetworkDispatcherOptions);

    const provider = factory.create({provider: options, factory: { bustCache, debug, sender }});
    const stateful = new StatefulProvider(provider, onError);

    // Init without blocking; surface errors
    void stateful.init().catch((err) => {
      logger.error('Provider initialization failed', err);
      onError(err);
    });

    logger.info('Provider loaded:', name, { version: factory.meta?.version ?? 'unknown' });
    return stateful;
  } catch (error) {
    logger.error(`Failed to load provider: ${name}`, error);
    throw error;
  }
}
