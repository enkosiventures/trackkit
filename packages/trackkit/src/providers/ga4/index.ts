import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props } from '../../types';
import { GA4Client } from './client';
import { validateGA4MeasurementId } from '../shared/validation';
import { createNavigationTracker } from '../shared/navigation';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Create GA4 provider instance
 */
function create(options: AnalyticsOptions): ProviderInstance {
  // Validate measurement ID
  const measurementIdValidation = validateGA4MeasurementId(options.siteId || '');
  
  if (!measurementIdValidation.valid) {
    throw new AnalyticsError(
      measurementIdValidation.error!,
      'INVALID_CONFIG',
      'ga4'
    );
  }
  
  const measurementId = measurementIdValidation.parsed!;
  
  // Create client
  const client = new GA4Client({
    measurementId,
    debug: options.debug,
    apiSecret: options.apiSecret,
    transport: options.transport as any,
    customDimensions: options.customDimensions,
    customMetrics: options.customMetrics,
    onError: options.onError,
  });
  
  // Navigation tracking
  let navigationTracker: ReturnType<typeof createNavigationTracker> | null = null;
  let navigationCallback: ((url: string) => void) | undefined;
  
  return {
    name: 'ga4',
    
    /**
     * Initialize provider
     */
    async _init() {
      logger.info('Initializing GA4 provider', {
        measurementId,
        debug: options.debug,
        transport: options.transport || 'beacon',
      });
      
      // Setup navigation tracking
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
      // Map common trackkit events to GA4 events
      const mappedProps = mapTrackitPropsToGA4(name, props);
      
      client.sendEvent(name, mappedProps, url).catch(error => {
        logger.error('Failed to send GA4 event', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Track pageview
     */
    pageview(url?: string) {
      client.sendPageview(url).catch(error => {
        logger.error('Failed to send GA4 pageview', error);
        options.onError?.(error);
      });
    },
    
    /**
     * Identify user
     */
    identify(userId: string | null) {
      client.setUserId(userId);
    },
    
    /**
     * Clean up
     */
    destroy() {
      logger.debug('Destroying GA4 provider');
      navigationTracker?.stop();
      navigationTracker = null;
      client.destroy();
    },
  };
}

/**
 * Map Trackkit properties to GA4 parameters
 */
function mapTrackitPropsToGA4(eventName: string, props?: Props): Props | undefined {
  if (!props) return undefined;
  
  const mapped: Props = { ...props };
  
  // Map common ecommerce properties
  if (eventName.toLowerCase().includes('cart') || eventName.toLowerCase() === 'purchase') {
    // Convert single item to items array
    if (mapped.item_id && !mapped.items) {
      mapped.items = [{
        item_id: mapped.item_id,
        item_name: mapped.item_name || mapped.name || 'Unknown',
        price: mapped.price,
        quantity: mapped.quantity || 1,
      }];
      
      // Remove individual properties
      delete mapped.item_id;
      delete mapped.item_name;
      delete mapped.price;
      delete mapped.quantity;
    }
  }
  
  // Map search properties
  if (eventName.toLowerCase() === 'search' && mapped.query && !mapped.search_term) {
    mapped.search_term = mapped.query;
    delete mapped.query;
  }
  
  return mapped;
}

/**
 * GA4 provider factory
 */
const ga4Provider: ProviderFactory = {
  create,
  meta: {
    name: 'ga4',
    version: '2.0.0',
    consentDefaults: {
      requireExplicit: true, // GA4 requires explicit consent by default
    },
  },
};

export default ga4Provider;