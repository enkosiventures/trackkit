import type { ProviderFactory } from './types';
import type { AnalyticsInstance, AnalyticsOptions, Props, ConsentState } from '../types';
import { logger } from '../util/logger';

/**
 * Create a no-op analytics instance
 * Used as default provider and fallback for errors
 */
function create(options: AnalyticsOptions): AnalyticsInstance {
  logger.debug('Creating no-op provider instance', options);

  /**
   * Log method call in debug mode
   */
  const log = (method: string, ...args: unknown[]) => {
    if (options.debug) {
      logger.debug(`[no-op] ${method}`, ...args);
    }
  };
  
  return {
    name: 'noop',
    track(name: string, props?: Props, url?: string): void {
      log('track', { name, props, url });
    },
    
    pageview(url?: string): void {
      log('pageview', { url });
    },
    
    identify(userId: string | null): void {
      log('identify', { userId });
    },
    
    destroy(): void {
      log('destroy');
    },
  };
}

const factory: ProviderFactory = {
  create,
  meta: {
    name: 'noop',
    version: '1.0.0',
  },
};
export default factory;