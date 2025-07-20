import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props, ConsentState } from '../../types';
import { UmamiClient } from './client';
import { parseWebsiteId, isBrowser } from './utils';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';
import { getInstance } from '../..';

/**
 * Track page visibility for accurate time-on-page
 */
let lastPageView: string | null = null;
let isPageHidden = false;

function setupPageTracking(client: UmamiClient, autoTrack: boolean, allowWhenHidden: boolean): void {
  if (!isBrowser() || !autoTrack) return;
  
  // Track initial pageview
  const currentPath = window.location.pathname + window.location.search;
  lastPageView = currentPath;
  client.trackPageviewWithVisibilityCheck().catch(error => {
    logger.error('Failed to track initial pageview', error);
  });
  
  // Track navigation changes
  let previousPath = currentPath;
  
  const checkForNavigation = () => {
    const newPath = window.location.pathname + window.location.search;
    if (newPath !== previousPath) {
      previousPath = newPath;
      lastPageView = newPath;
      client.updateBrowserData();
      client.trackPageviewWithVisibilityCheck(newPath, allowWhenHidden).catch(error => {
        logger.error('Failed to track navigation', error);
      });
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
  document.addEventListener('visibilitychange', () => {
    isPageHidden = document.hidden;
  });
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
      setConsent: () => {},
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
  
  // Track consent state
  let consentGranted = false;
  
  // Setup auto-tracking
  const autoTrack = options.autoTrack ?? true;

  // Setup tracking when page is hidden
  const allowWhenHidden = options.allowWhenHidden ?? false;
  
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
      if (consentGranted) {
        setupPageTracking(client, autoTrack, allowWhenHidden);
      }
    },
    
    /**
     * Track custom event
     */
    track(name: string, props?: Props, url?: string) {
      // console.warn("[UMAMI] Track called with:", name, props);
      // console.warn("[UMAMI] Current instance:", getInstance());
      // console.warn("[UMAMI] Consent state:", consentGranted);

      if (!consentGranted) {
        // console.warn("[UMAMI] Event not sent: consent not granted", { name });
        logger.debug('Event not sent: consent not granted', { name });
        return;
      }
      
      // Don't track if page is hidden (user switched tabs)
      if (isPageHidden) {
        // console.warn("[UMAMI] Event not sent: page is hidden", { name });
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
      if (!consentGranted) {
        logger.debug('Pageview not sent: consent not granted', { url });
        return;
      }
      
      // Update last pageview
      lastPageView = url || window.location.pathname + window.location.search;
      
      client.updateBrowserData();
      client.trackPageviewWithVisibilityCheck(url, allowWhenHidden).catch(error => {
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
     * Update consent state
     */
    setConsent(state: ConsentState) {
      consentGranted = state === 'granted';
      logger.debug('Consent state updated', { state });
      
      if (consentGranted && autoTrack && lastPageView === null) {
        // Setup tracking if consent granted after init
        setupPageTracking(client, autoTrack, allowWhenHidden);
      }
    },
    
    /**
     * Clean up
     */
    destroy() {
      logger.debug('Destroying Umami provider');
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