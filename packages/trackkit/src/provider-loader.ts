import type { ProviderFactory } from './providers/types';
import type { ProviderType, AnalyticsOptions } from './types';
import { StatefulProvider } from './providers/stateful-wrapper';
import { logger } from './util/logger';

/**
 * Provider loading strategies
 */
type SyncLoader = () => ProviderFactory;
type AsyncLoader = () => Promise<ProviderFactory>;
type ProviderLoader = SyncLoader | AsyncLoader;

/**
 * Check if loader is async
 */
function isAsyncLoader(loader: ProviderLoader): loader is AsyncLoader {
  return loader.constructor.name === 'AsyncFunction' || 
         loader.toString().includes('import(');
}

/**
 * Registry of available providers
 * @internal
 */
import noopAdapter from './providers/noop';  // Temporary synchronous import for noop provider
const providerRegistry = new Map<ProviderType, ProviderLoader>([
  ['noop', () => noopAdapter],
  // Future providers will use dynamic imports:
  // ['umami', () => import('./providers/umami').then(m => m.default)],
]);

/**
 * Load and wrap provider with state management
 */
export async function loadProvider(
  name: ProviderType,
  options: AnalyticsOptions
): Promise<StatefulProvider> {
  logger.debug(`Loading provider: ${name}`);
  
  const loader = providerRegistry.get(name);
  
  if (!loader) {
    throw new Error(`Unknown analytics provider: ${name}`);
  }
  
  try {
    // Load the provider factory
    const factory = isAsyncLoader(loader) 
      ? await loader() 
      : loader();
    
    if (!factory || typeof factory.create !== 'function') {
      throw new Error(`Invalid provider factory for: ${name}`);
    }
    
    // Create provider instance
    const provider = factory.create(options);
    
    // Wrap with state management
    const statefulProvider = new StatefulProvider(provider, options);
    
    // Initialize asynchronously
    statefulProvider.init().catch(error => {
      logger.error('Provider initialization failed', error);
      options.onError?.(error);
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