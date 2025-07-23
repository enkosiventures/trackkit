import { ProviderLoader } from './types';
import type { ProviderType } from '../types';

/**
 * Provider registry with lazy loading
 */
export const providers: Record<ProviderType, ProviderLoader> = {
  noop: () => import('./noop').then(m => m.default),
  umami: () => import('./umami').then(m => m.default),
  // Future providers:
  // plausible: () => import('./providers/plausible').then(m => m.default),
  // ga: () => import('./providers/ga').then(m => m.default),
};