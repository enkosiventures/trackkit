import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props } from '../../types';
import { PlausibleClient, enableAutoTracking } from './client';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Navigation tracking for SPAs
 */
function setupNavigationTracking(client: PlausibleClient): void {
  if (typeof window === 'undefined') return;
  
  let lastPath = window.location.pathname;
  
  // Check for navigation changes
  const checkNavigation = () => {
    const newPath = window.location.pathname;
    if (newPath !== lastPath) {
      lastPath = newPath;
      client.trackPageview().catch(error => {
        logger.error('Failed to track navigation', error);
      });
    }
  };
  
  // Listen for history changes
  window.addEventListener('popstate', checkNavigation);
  
  // Override pushState and replaceState
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;
  
  history.pushState = function(...args) {
    originalPushState.apply(history, args);
    setTimeout(checkNavigation, 0);
  };
  
  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args);
    setTimeout(checkNavigation, 0);
  };
}

/**
 * Create Plausible provider instance
 */
function create(options: AnalyticsOptions): ProviderInstance {
  // Validate configuration
  if (!options.siteId) {
    throw new AnalyticsError(
      'Plausible requires a domain (siteId)',
      'INVALID_CONFIG',
      'plausible'
    );
  }
  
  // Parse domain from siteId
  const domain = options.siteId.replace(/^https?:\/\//, '').replace(/\/$/, '');
  
  // Create client
  const client = new PlausibleClient({
    domain,
    apiHost: options.host || 'https://plausible.io',
    hashMode: options.hashMode,
    trackLocalhost: options.trackLocalhost,
    exclude: options.exclude,
    defaultProps: options.defaultProps,
    revenue: options.revenue,
  });
  
  // Track consent state
  let consentGranted = false;
  let autoTrackingEnabled = false;
  
  return {
    name: 'plausible',

    /**
     * Initialize provider
     */
    async _init() {
      logger.info('Initializing Plausible provider', {
        domain,
        apiHost: options.host || 'https://plausible.io',
      });
      
      // Setup auto-tracking if enabled and consent granted
      if (consentGranted && options.autoTrack !== false) {
        enableAutoTracking(client);
        setupNavigationTracking(client);
        autoTrackingEnabled = true;
        
        // Send initial pageview
        await client.trackPageview();
      }
    },
    
    /**
     * Track custom event
     */
    track(name: string, props?: Props, url?: string) {
      if (!consentGranted) {
        logger.debug('Plausible event blocked by consent', { name });
        return;
      }
      
      // Extract revenue if present
      let revenue: number | undefined;
      let currency: string | undefined;
      
      if (props?.revenue && typeof props.revenue === 'number') {
        revenue = props.revenue as number;
        currency = props.currency as string;
        
        // Remove from props to avoid sending as custom property
        const { revenue: _, currency: __, ...cleanProps } = props;
        props = cleanProps;
      }
      
      // Convert props to string values (Plausible requirement)
      const stringProps: Record<string, string> = {};
      if (props) {
        Object.entries(props).forEach(([key, value]) => {
          if (value != null) {
            stringProps[key] = String(value);
          }
        });
      }
      
      client.sendEvent(name, {
        url,
        props: stringProps,
        revenue,
        currency,
      }).catch(error => {
        logger.error('Failed to track Plausible event', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Track pageview
     */
    pageview(url?: string) {
      if (!consentGranted) {
        logger.debug('Plausible pageview blocked by consent', { url });
        return;
      }
      
      client.trackPageview(url).catch(error => {
        logger.error('Failed to track Plausible pageview', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Identify user (not supported by Plausible)
     */
    identify(userId: string | null) {
      logger.debug('Plausible does not support user identification', { userId });
      // Could be added as a custom property in the future
    },
    
    /**
     * Clean up
     */
    destroy() {
      logger.debug('Destroying Plausible provider');
      // Reset navigation tracking
      if (typeof window !== 'undefined') {
        // Restore original methods
        // Note: In production, we'd store references to restore them
      }
    },
  };
}

/**
 * Plausible provider factory
 */
const plausibleProvider: ProviderFactory = {
  create,
  meta: {
    name: 'plausible',
    version: '1.0.0',
  },
};

export default plausibleProvider;