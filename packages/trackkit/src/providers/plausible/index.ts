import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props } from '../../types';
import { PlausibleClient } from './client';
import { validateDomain } from '../shared/validation';
import { isBrowser } from '../shared/browser';
import { debugLog, logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Set up Plausible outbound auto-tracking features
 */
function setupOutboundAutoTracking(client: PlausibleClient): () => void {
  if (!isBrowser()) return () => {};
  
  const cleanupFunctions: Array<() => void> = [];
  
  // Track outbound links
  const handleClick = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link?.href) return;
    
    try {
      const url = new URL(link.href);
      if (url.host !== window.location.host) {
        // Let errors bubble up
        client.trackOutboundLink(link.href);
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
      // Let errors bubble up
      client.trackFileDownload(fileName);
    }
  };
  
  document.addEventListener('click', handleDownload);
  cleanupFunctions.push(() => document.removeEventListener('click', handleDownload));
  
  // Track 404 errors
  if (document.title.toLowerCase().includes('404') || 
      document.body.textContent?.toLowerCase().includes('page not found')) {
    // Let errors bubble up
    client.track404();
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
  let autoOutboundTrackingCleanup: (() => void) | null = null;
  
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
        autoOutboundTrackingCleanup = setupOutboundAutoTracking(client);
      }
    },
    
    /**
     * Track custom event
     */
    async track(name: string, props?: Props, url?: string) {
      debugLog('starting tracking event')
      // Let errors bubble up to facade
      await client.sendEvent(name, props, url);
    },
    
    /**
     * Track pageview
     */
    async pageview(url?: string) {
      // Let errors bubble up to facade
      await client.sendPageview(url);
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
      autoOutboundTrackingCleanup?.();
      autoOutboundTrackingCleanup = null;
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