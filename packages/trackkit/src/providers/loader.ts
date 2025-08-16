import type { AsyncLoader, ProviderLoader } from './types';
import type { ProviderType, ProviderOptions } from '../types';
import { StatefulProvider } from './stateful-wrapper';
import { providers } from './registry';
import { logger } from '../util/logger';
import { AnalyticsError } from '../errors';
import { DEFAULT_CACHING, DEFAULT_ERROR_HANDLER, DEFAULT_PROVIDER, DEFAULT_PROVIDER_OPTIONS } from '../constants';

/**
 * Check if loader is async
 */
function isAsyncLoader(loader: ProviderLoader): loader is AsyncLoader {
  try {
    return loader() instanceof Promise;
  } catch {
    return false;
  }
}

/**
 * Registry of available providers
 * @internal
 */
const providerRegistry = new Map(
  Object.entries(providers).map(([name, loader]) => [name as ProviderType, loader])
);

/**
 * Load and wrap provider with state management
 */
export async function loadProvider(
  providerOptions: ProviderOptions | null,
  cache?: boolean,
  debug?: boolean,
  onError: (error: AnalyticsError) => void = DEFAULT_ERROR_HANDLER,
): Promise<StatefulProvider> {
  const options = providerOptions || DEFAULT_PROVIDER_OPTIONS;
  const name = options.provider ?? DEFAULT_PROVIDER;

  logger.debug(`Loading provider: ${name}`);
  
  const loader = providerRegistry.get(name);
  
  if (!loader) {
    logger.error(`Unknown analytics provider: ${name}`);
    throw new Error(`Unknown analytics provider: ${name}`);
  }
  
  try {
    // Load the provider factory
    const factory = isAsyncLoader(loader) 
      ? await loader() 
      : loader();
    
    // @ts-ignore: factory is loaded whether sync or async
    if (!factory || typeof factory.create !== 'function') {
      logger.error(`Invalid provider factory for: ${name}`);
      throw new Error(`Invalid provider factory for: ${name}`);
    }
    
    // Create provider instance
    const provider = factory.create(options, cache, debug);
    
    // Wrap with state management
    const statefulProvider = new StatefulProvider(provider, onError);

    // Initialize asynchronously
    statefulProvider.init().catch(error => {
      logger.error('Provider initialization failed', error);
      onError(error);
    });
    
    logger.info(`Provider loaded: ${name}`, {
      version: factory.meta?.version || 'unknown',
    });

    return statefulProvider;

  } catch (error) {
    logger.error(`Failed to load provider: ${name}`, error);
    throw error;
  }
}

/**
 * Preload a provider without initializing
 * Useful for warming up dynamic imports
 */
export async function preloadProvider(name: ProviderType): Promise<void> {
  const loader = providerRegistry.get(name);
  
  if (!loader || !isAsyncLoader(loader)) {
    return;
  }
  
  try {
    await loader();
    logger.debug(`Provider preloaded: ${name}`);
  } catch (error) {
    logger.warn(`Failed to preload provider: ${name}`, error);
  }
}