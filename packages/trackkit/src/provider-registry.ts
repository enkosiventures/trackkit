import { ProviderLoader } from './providers/types';
import type { ProviderType } from './types';

/**
 * Provider registry with lazy loading
 */
export const providers: Record<ProviderType, ProviderLoader> = {
  noop: () => import('./providers/noop').then(m => m.default),
  umami: () => import('./providers/umami').then(m => m.default),
  // Future providers:
  // plausible: () => import('./providers/plausible').then(m => m.default),
  // ga: () => import('./providers/ga').then(m => m.default),
};