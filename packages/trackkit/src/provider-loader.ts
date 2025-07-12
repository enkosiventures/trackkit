import type { ProviderFactory } from './providers/types';
import type { ProviderType } from './types';

/**
 * Provider loading strategy that supports both sync (Stage 1) 
 * and async (future stages) imports
 */
type ProviderLoader = () => ProviderFactory | Promise<ProviderFactory>;

/**
 * Registry of available providers
 * @internal
 */
import noopAdapter from './providers/noop';
const providerRegistry = new Map<ProviderType, ProviderLoader>([
  ['noop', () =>  noopAdapter],
  // ['noop', () =>  require('./providers/noop').default], // Synchronous for Stage 1
  // Future providers will use dynamic imports:
  // ['umami', () => import('./providers/umami').then(m => m.default)],
]);

/**
 * Load a provider by name
 * @internal
 */
export async function loadProvider(name: ProviderType): Promise<ProviderFactory> {
  const loader = providerRegistry.get(name);
  
  if (!loader) {
    throw new Error(`Unknown analytics provider: ${name}`);
  }
  
  const factory = await loader();
  
  if (!factory || typeof factory.create !== 'function') {
    throw new Error(`Invalid provider factory for: ${name}`);
  }
  
  return factory;
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
