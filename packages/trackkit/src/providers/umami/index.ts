// src/providers/umami/index.ts
import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props } from '../../types';
import { UmamiClient } from './client';
import { parseWebsiteId, isBrowser } from './utils';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Track page visibility for accurate time-on-page
 */
let lastPageView: string | null = null;
let isPageHidden = false;

// function setupPageTracking(client: UmamiClient, autoTrack: boolean, allowWhenHidden: boolean): void {
function setupPageTracking(
  client: UmamiClient, 
  autoTrack: boolean, 
  onNavigate?: (url: string) => void,
): () => void {
  if (!isBrowser() || !autoTrack) return () => {};
  
  // Track navigation changes
  let previousPath = window.location.pathname + window.location.search;
  
  const checkForNavigation = () => {
    const newPath = window.location.pathname + window.location.search;
    if (newPath !== previousPath) {
      previousPath = newPath;
      client.updateBrowserData();
      
      // Instead of tracking directly, notify the facade
      if (onNavigate) {
        onNavigate(newPath);
      }
    }
  };
  
  // Listen for history changes (SPA navigation)
  window.addEventListener('popstate', checkForNavigation);
  
  // Override pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(checkForNavigation, 0);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(checkForNavigation, 0);
  };
  
  // Track page visibility
  const handleVisibilityChange = () => {
    isPageHidden = document.hidden;
  };
  document.addEventListener('visibilitychange', handleVisibilityChange);

  // Return cleanup function
  return () => {
    window.removeEventListener('popstate', checkForNavigation);
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    history.pushState = originalPushState;
    history.replaceState = originalReplaceState;
  };
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
    logger.warn('Umami browser adapter requires a browser environment');
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
    cache: options.cache ?? true,
  });
  
  // Setup auto-tracking
  const autoTrack = options.autoTrack ?? true;

  // Setup tracking when page is hidden
  const allowWhenHidden = options.allowWhenHidden ?? false;

  let navigationCallback: ((url: string) => void) | undefined;
  let cleanupAutoTracking: (() => void) | undefined;
  
  return {
    name: 'umami-browser',
    /**
     * Initialize provider
     */
    async _init() {
      logger.info('Initializing Umami provider', {
        websiteId,
        hostUrl: options.host || 'https://cloud.umami.is',
        autoTrack,
      });
      
      // Setup automatic pageview tracking
      // Note: Initial pageview will be sent by facade after consent check
      cleanupAutoTracking = setupPageTracking(
        client,
        autoTrack,
        navigationCallback,
      );
    },

    // Add a method to set the navigation callback
    _setNavigationCallback(callback: (url: string) => void) {
      navigationCallback = callback;
    },
    
    /**
     * Track custom event
     */
    track(name: string, props?: Props, url?: string) {
      // Don't track if page is hidden (unless overridden)
      if (isPageHidden && !allowWhenHidden) {
        logger.debug('Event not sent: page is hidden', { name });
        return;
      }
      
      client.trackEvent(name, props, url).catch(error => {
        logger.error('Failed to track event', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Track pageview
     */
    pageview(url?: string) {
      // Update last pageview
      lastPageView = url || window.location.pathname + window.location.search;
      
      // Don't track if page is hidden (unless overridden)
      if (isPageHidden && !allowWhenHidden) {
        logger.debug('Pageview not sent: page is hidden', { url });
        return;
      }

      client.updateBrowserData();
      client.trackPageview(url).catch(error => {
        logger.error('Failed to track pageview', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Identify user (Umami doesn't support user identification)
     */
    identify(userId: string | null) {
      logger.debug('Umami does not support user identification', { userId });
      // Could be used to set a custom dimension in the future
    },
    
    /**
     * Clean up
     */
    destroy() {
      logger.debug('Destroying Umami provider');
      cleanupAutoTracking?.();
      lastPageView = null;
      isPageHidden = false;
    },
  };
}

/**
 * Umami browser provider factory
 */
const umamiProvider: ProviderFactory = {
  create,
  meta: {
    name: 'umami-browser',
    version: '1.0.0',
  },
};

export default umamiProvider;