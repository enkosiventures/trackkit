import type { ProviderType, ProviderOptions } from '../types';
import { StatefulProvider } from './stateful-wrapper';
import { providers } from './registry';
import { logger } from '../util/logger';
import type { AnalyticsError } from '../errors';
import { makeDispatcherSender } from './base/transport';
import type { NetworkDispatcherOptions } from '../dispatcher';
import type { ResolvedBatchingOptions, ResolvedResilienceOptions, TransportMode } from '../dispatcher/types';
import type { PerformanceTracker } from '../performance/tracker';
import { DiagnosticsService } from '../facade/diagnostics';


/**
 * Registry of available providers
 * @internal
 */
const providerRegistry = new Map(
  Object.entries(providers).map(([name, loader]) => [name as ProviderType, loader])
);


export type LoadProviderOptions = {
  providerConfig: ProviderOptions;
  batching: ResolvedBatchingOptions;
  resilience: ResolvedResilienceOptions;
  transportMode: TransportMode;
  defaultHeaders: Record<string, string | undefined>;
  bustCache: boolean;
  debug: boolean;
  onError: (error: AnalyticsError) => void;
  diagnostics?: DiagnosticsService | null;
  performanceTracker?: PerformanceTracker | null;
};


export async function loadProvider(options: LoadProviderOptions): Promise<StatefulProvider> {
  const name = options.providerConfig.name;
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

    const sender = makeDispatcherSender(options satisfies NetworkDispatcherOptions);

    const provider = factory.create({
      provider: options.providerConfig,
      factory: { bustCache: options.bustCache, debug: options.debug, sender },
    });
    const stateful = new StatefulProvider(provider, options.onError);

    // Init without blocking; surface errors
    void stateful.init().catch((err) => {
      logger.error('Provider initialization failed', err);
      options.onError(err);
    });

    logger.info('Provider loaded:', name, { version: factory.meta?.version ?? 'unknown' });
    return stateful;
  } catch (error) {
    logger.error(`Failed to load provider: ${name}`, error);
    throw error;
  }
}
