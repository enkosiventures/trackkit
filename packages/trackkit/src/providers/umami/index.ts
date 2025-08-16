import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, PageContext, Props } from '../../types';
import { UmamiClient } from './client';
import { validateUUID } from '../shared/validation';
import { isBrowser } from '../shared/browser';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Parse and validate Umami website ID
 */
function parseWebsiteId(siteId?: string): string | null {
  if (!siteId) return null;
  
  // Handle Umami script data attributes format
  const cleaned = siteId.replace('data-website-id=', '');
  
  // Validate UUID format
  const validation = validateUUID(cleaned);
  
  if (validation.valid) {
    return validation.parsed!;
  }
  
  // Some Umami instances might use non-UUID IDs
  // If it's not a UUID but looks reasonable, accept it
  if (cleaned.length >= 10 && /^[a-zA-Z0-9-_]+$/.test(cleaned)) {
    return cleaned;
  }
  
  return null;
}

/**
 * Create Umami provider instance
 */
function create(options: AnalyticsOptions): ProviderInstance {
  // Validate configuration
  const siteId = parseWebsiteId(options.siteId);
  if (!siteId) {
    throw new AnalyticsError(
      'Umami requires a valid site ID',
      'INVALID_CONFIG',
      'umami'
    );
  }
  
  // Check browser environment
  if (!isBrowser()) {
    logger.warn('Umami requires a browser environment');
    // Return no-op implementation for SSR
    return {
      name: 'umami-noop',
      track: () => {},
      pageview: () => {},
      identify: () => {},
      destroy: () => {},
    };
  }
  
  // Create client
  const client = new UmamiClient({
    ...options,
    autoTrack: options.autoTrack ?? true,
    doNotTrack: options.doNotTrack ?? true,
    cache: options.cache ?? false,
    siteId,
  });
  
  return {
    name: 'umami',
    
    /**
     * Initialize provider
     */
    async _init() {
      logger.info('Initializing Umami provider', {
        websiteId,
        hostUrl: options.host || 'https://cloud.umami.is',
        autoTrack: options.autoTrack ?? true,
      });
    },
    
    /**
     * Track custom event
     */
    async track(name: string, props?: Props, url?: string, category?: string, pageContext?: PageContext) {
      // Async errors will be caught by facade
      // client.sendEvent(name, props, url).catch(error => {
      //   throw error; // Re-throw for facade to catch
      // });
      // Let errors bubble up naturally
      await client.sendEvent(name, props, url, category, pageContext);
    },
    
    /**
     * Track pageview
     */
    async pageview(url?: string, pageContext?: PageContext) {
      await client.sendPageview(url, pageContext);
    },

    /**
     * Identify user (not supported by Umami)
     */
    identify(userId: string | null) {
      logger.debug('Umami does not support user identification', { userId });
    },
    
    /**
     * Clean up
     */
    destroy() {
      logger.debug('Destroying Umami provider');
      client.destroy();
    },
  };
}

/**
 * Umami provider factory
 */
const umamiProvider: ProviderFactory = {
  create,
  meta: {
    name: 'umami',
    version: '2.0.0',
  },
};

export default umamiProvider;