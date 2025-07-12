import type { ProviderFactory } from './providers/types';
import type { AnalyticsInstance, AnalyticsOptions, ProviderType } from './types';
import { AnalyticsError } from './errors';
import { logger } from './util/logger';

// Temporary sync import, will be replaced with dynamic import in future stages
import noopAdapter from './providers/noop';

/**
 * Map of provider names to their factory functions
 * This allows for dynamic loading of providers in the future
 * @internal
 */
const providerMap: Record<string, () => ProviderFactory> = {
  noop: () => require('./providers/noop').default,
  // Future providers will use dynamic imports
};


/**
 * Provider loading strategy that supports both sync (Stage 1) 
 * and async (future stages) imports
 */
type ProviderLoader = () => ProviderFactory;
// type ProviderLoader = () => ProviderFactory | Promise<ProviderFactory>;

/**
 * Registry of available providers
 * @internal
 */
const providerRegistry = new Map<ProviderType, ProviderLoader>([
  ['noop', () =>  noopAdapter],
  // ['noop', () =>  require('./providers/noop').default], // Synchronous for Stage 1
  // Future providers will use dynamic imports:
  // ['umami', () => import('./providers/umami').then(m => m.default)],
]);

/**
 * Load a provider by name
 * @param name - Provider name
 * @returns Provider factory function
 * @throws {AnalyticsError} if provider is unknown or fails to load
 */
export function loadProvider(name: ProviderType): ProviderFactory {
  logger.debug(`Loading provider: ${name}`);
  
  const loader = providerRegistry.get(name);
  if (!loader) {
    throw new AnalyticsError(
      `Unknown provider: ${name}`,
      'INIT_FAILED',
      name
    );
  }
  
  try {
    return loader();
  } catch (error) {
    throw new AnalyticsError(
      `Failed to load provider: ${name}`,
      'INIT_FAILED',
      name,
      error
    );
  }
}

/**
 * Synchronous provider loading for Stage 1
 * @internal
 */
export function loadProviderSync(name: ProviderType): ProviderFactory {
  if (name !== 'noop') {
    throw new Error(`Sync loading only supported for 'noop' provider`);
  }
  
  const loader = providerRegistry.get(name);
  if (!loader) {
    throw new Error(`Unknown analytics provider: ${name}`);
  }
  
  return loader() as ProviderFactory;
}
