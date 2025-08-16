import { ProviderLoader } from './types';
import type { ProviderType } from '../types';

/**
 * Provider registry with lazy loading
 */
export const providers: Record<ProviderType, ProviderLoader> = {
  noop: () => import('./noop').then(m => m.default),
  umami: () => import('./new/umami').then(m => m.default),
  plausible: () => import('./new/plausible').then(m => m.default),
  ga4: () => import('./new/ga4').then(m => m.default),
};