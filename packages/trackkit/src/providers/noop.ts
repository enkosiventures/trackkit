import type { PageContext, Props, ProviderInstance, ProviderOptions } from '../types';
import { logger } from '../util/logger';
import { stripEmptyFields } from './shared/utils';
import type { ProviderFactory } from './types';


/**
 * Create a no-op analytics instance
 * Used as default provider and fallback for errors
 */
function create(
  options: ProviderOptions,
  bustCache?: boolean,
  debug?: boolean,
): ProviderInstance {
  logger.debug('Creating no-op provider instance', options);

  /**
   * Log method call in debug mode
   */
  const log = (method: string, ...args: unknown[]) => {
    if (debug) {
      logger.debug(`[no-op] ${method}`, ...args);
    }
  };
  
  return {
    name: 'noop',
    
    track(name: string, props: Props, pageContext: PageContext): Promise<void> {
      log('track', { name, props, pageContext: stripEmptyFields(pageContext) });
      return Promise.resolve();
    },
    
    pageview(pageContext: PageContext): Promise<void> {
      log('pageview', { pageContext: stripEmptyFields(pageContext) });
      return Promise.resolve();
    },
    
    identify(userId: string | null): void {
      log('identify', { userId });
    },
    
    destroy(): void {
      log('destroy');
    },
  };
}

const noopProvider: ProviderFactory = {
  create,
  meta: {
    name: 'noop',
    version: '1.0.0',
  },
};

export default noopProvider;