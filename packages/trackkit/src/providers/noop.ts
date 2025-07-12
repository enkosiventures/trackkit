import type { ProviderFactory, ProviderInstance } from './types';
import type { AnalyticsOptions, Props, ConsentState } from '../types';

/**
 * Create a no-op analytics instance
 * Used as default provider and fallback for errors
 */
function create(options: AnalyticsOptions): ProviderInstance {
  const { debug } = options;
  
  /**
   * Log method call in debug mode
   */
  const log = (method: string, data?: unknown): void => {
    if (debug) {
      console.log(`[trackkit:noop] ${method}`, data);
    }
  };
  
  return {
    track(name: string, props?: Props, url?: string): void {
      log('track', { name, props, url });
    },
    
    pageview(url?: string): void {
      log('pageview', { url });
    },
    
    identify(userId: string | null): void {
      log('identify', { userId });
    },
    
    setConsent(state: ConsentState): void {
      log('setConsent', { state });
    },
    
    destroy(): void {
      log('destroy');
    },
  };
}

/**
 * No-op provider factory
 */
const noopProvider: ProviderFactory = {
  create,
  meta: {
    name: 'noop',
    version: '1.0.0',
  },
};

export default noopProvider;