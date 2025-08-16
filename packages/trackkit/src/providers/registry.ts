import { ProviderLoader } from './types';
import type { ProviderType } from '../types';

/**
 * Provider registry with lazy loading
 */
export const providers: Record<ProviderType, ProviderLoader> = {
  noop: () => import('./noop').then(m => m.default),
  umami: () => import('./umami').then(m => m.default),
  plausible: () => import('./plausible').then(m => m.default),
  ga4: () => import('./ga4').then(m => m.default),
};