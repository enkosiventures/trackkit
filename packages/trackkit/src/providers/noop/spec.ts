import type { PageContext, Props, ProviderInstance, ProviderOptions } from '../../types';
import { logger } from '../../util/logger';
import { stripEmptyFields } from '../../util';
import type { FactoryOptions, ProviderFactory } from '../types';


/**
 * Create a no-op analytics instance
 * Used as default provider and fallback for errors
 */
function create(
  options: {
    provider: ProviderOptions;
    factory?: FactoryOptions;
  },
): ProviderInstance {
  logger.debug('Creating no-op provider instance', options);

  /**
   * Log method call in debug mode
   */
  const log = (method: string, ...args: unknown[]) => {
    if (options.factory?.debug) {
      logger.debug(`[no-op] ${method}`, ...args);
    }
  };

  return {
    name: 'noop',

    track(name: string, props: Props, pageContext: PageContext): Promise<void> {
      log('track', { name, props, pageContext: stripEmptyFields(pageContext) });
      if (options.factory?.sender.type === 'noop') {
        options.factory.sender.send({
          method: 'POST',
          url: 'https://noop.local/track',
          headers: {},
          body: { name, props, pageContext },
        });
      }
      return Promise.resolve();
    },

    pageview(pageContext: PageContext): Promise<void> {
      log('pageview', { pageContext: stripEmptyFields(pageContext) });
      if (options.factory?.sender.type === 'noop') {
        options.factory.sender.send({
          method: 'POST',
          url: 'https://noop.local/pageview',
          headers: {},
          body: { pageContext },
        });
      }
      return Promise.resolve();
    },

    identify(userId: string | null): void {
      log('identify', { userId });
      if (options.factory?.sender.type === 'noop') {
        options.factory.sender.send({
          method: 'POST',
          url: 'https://noop.local/identify',
          headers: {},
          body: { userId },
        });
      }
    },

    destroy(): void {
      log('destroy');
      if (options.factory?.sender.type === 'noop') {
        options.factory.sender.send({
          method: 'POST',
          url: 'https://noop.local/destroy',
          headers: {},
          body: {},
        });
      }
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