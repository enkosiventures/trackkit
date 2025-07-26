import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props } from '../../types';
import { PlausibleClient } from './client';
import { validateDomain } from '../shared/validation';
import { isBrowser } from '../shared/browser';
import { createNavigationTracker } from '../shared/navigation';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Set up Plausible auto-tracking features
 */
function setupAutoTracking(client: PlausibleClient): () => void {
  if (!isBrowser()) return () => {};
  
  const cleanupFunctions: Array<() => void> = [];
  
  // Track outbound links
  const handleClick = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link?.href) return;
    
    try {
      const url = new URL(link.href);
      if (url.host !== window.location.host) {
        client.trackOutboundLink(link.href).catch(error => {
          logger.error('Failed to track outbound link', error);
        });
      }
    } catch {
      // Invalid URL, ignore
    }
  };
  
  document.addEventListener('click', handleClick);
  cleanupFunctions.push(() => document.removeEventListener('click', handleClick));
  
  // Track file downloads
  const downloadExtensions = [
    'pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc',
    'ppt', 'pptx', 'zip', 'rar', 'tar', 'gz',
  ];
  
  const handleDownload = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link?.href) return;
    
    const extension = link.href.split('.').pop()?.toLowerCase();
    if (extension && downloadExtensions.includes(extension)) {
      const fileName = link.href.split('/').pop() || 'unknown';
      client.trackFileDownload(fileName).catch(error => {
        logger.error('Failed to track file download', error);
      });
    }
  };
  
  document.addEventListener('click', handleDownload);
  cleanupFunctions.push(() => document.removeEventListener('click', handleDownload));
  
  // Track 404 errors
  if (document.title.toLowerCase().includes('404') || 
      document.body.textContent?.toLowerCase().includes('page not found')) {
    client.track404().catch(error => {
      logger.error('Failed to track 404', error);
    });
  }
  
  // Return cleanup function
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
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
  
  // Validate domain format
  const domainValidation = validateDomain(options.siteId);
  if (!domainValidation.valid) {
    throw new AnalyticsError(
      domainValidation.error!,
      'INVALID_CONFIG',
      'plausible'
    );
  }
  
  const domain = domainValidation.parsed!;
  
  // Create client
  const client = new PlausibleClient({
    domain,
    apiHost: options.host,
    hashMode: options.hashMode,
    trackLocalhost: options.trackLocalhost,
    exclude: options.exclude,
    defaultProps: options.defaultProps,
    revenue: options.revenue,
  });
  
  // Tracking state
  let navigationTracker: ReturnType<typeof createNavigationTracker> | null = null;
  let autoTrackingCleanup: (() => void) | null = null;
  let navigationCallback: ((url: string) => void) | undefined;
  
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
      
      // Setup auto-tracking features
      if (options.autoTrack !== false) {
        autoTrackingCleanup = setupAutoTracking(client);
        
        // Setup navigation tracking
        if (navigationCallback) {
          navigationTracker = createNavigationTracker((url) => {
            client.updateBrowserData();
            navigationCallback!(url);
          });
        }
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
        logger.error('Failed to track Plausible event', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Track pageview
     */
    pageview(url?: string) {
      client.sendPageview(url).catch(error => {
        logger.error('Failed to track Plausible pageview', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Identify user (not supported by Plausible)
     */
    identify(userId: string | null) {
      logger.debug('Plausible does not support user identification', { userId });
    },
    
    /**
     * Clean up
     */
    destroy() {
      logger.debug('Destroying Plausible provider');
      navigationTracker?.stop();
      navigationTracker = null;
      autoTrackingCleanup?.();
      autoTrackingCleanup = null;
      client.destroy();
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
    version: '2.0.0',
  },
};

export default plausibleProvider;