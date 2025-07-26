import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props } from '../../types';
import { UmamiClient } from './client';
import { validateUUID, createValidationError } from '../shared/validation';
import { isBrowser } from '../shared/browser';
import { createNavigationTracker } from '../shared/navigation';
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
  const websiteId = parseWebsiteId(options.siteId);
  if (!websiteId) {
    throw new AnalyticsError(
      'Umami requires a valid website ID',
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
    websiteId,
    hostUrl: options.host,
    autoTrack: options.autoTrack ?? true,
    doNotTrack: options.doNotTrack ?? true,
    domains: options.domains,
    cache: options.cache ?? false,
  });
  
  // Navigation tracking
  let navigationTracker: ReturnType<typeof createNavigationTracker> | null = null;
  let navigationCallback: ((url: string) => void) | undefined;
  
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
      
      // Setup automatic pageview tracking
      if (options.autoTrack !== false && navigationCallback) {
        navigationTracker = createNavigationTracker((url) => {
          client.updateBrowserData();
          navigationCallback!(url);
        });
      }
    },
    
    /**
     * Set navigation callback from facade
     */
    _setNavigationCallback(callback: (url: string) => void) {
      navigationCallback = callback;
      
      // If already initialized and auto-tracking is enabled, start tracking
      if (options.autoTrack !== false && !navigationTracker) {
        navigationTracker = createNavigationTracker((url) => {
          client.updateBrowserData();
          callback(url);
        });
      }
    },
    
    /**
     * Track custom event
     */
    track(name: string, props?: Props, url?: string) {
      client.sendEvent(name, props, url).catch(error => {
        logger.error('Failed to track Umami event', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Track pageview
     */
    pageview(url?: string) {
      client.updateBrowserData();
      client.sendPageview(url).catch(error => {
        logger.error('Failed to track Umami pageview', error);
        options.onError?.(error);
      });
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
      navigationTracker?.stop();
      navigationTracker = null;
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