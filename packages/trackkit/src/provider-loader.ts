import type { AsyncLoader, ProviderLoader } from './providers/types';
import type { ProviderType, AnalyticsOptions } from './types';
import { StatefulProvider } from './providers/stateful-wrapper';
import { providers } from './provider-registry';
import { logger } from './util/logger';

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
  name: ProviderType,
  options: AnalyticsOptions,
  onReady?: () => void,
): Promise<StatefulProvider> {
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
    // @ts-ignore: factory is loaded whether sync or async
    const provider = factory.create(options);
    
    // Wrap with state management
    const statefulProvider = new StatefulProvider(provider, options, onReady);

    // Initialize asynchronously
    statefulProvider.init().catch(error => {
      logger.error('Provider initialization failed', error);
      options.onError?.(error);
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