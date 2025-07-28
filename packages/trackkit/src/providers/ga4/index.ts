import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, PageContext, Props } from '../../types';
import { GA4Client } from './client';
import { validateGA4MeasurementId } from '../shared/validation';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * GA4-specific options that extend AnalyticsOptions
 */
interface GA4AnalyticsOptions extends AnalyticsOptions {
  /**
   * Custom dimensions mapping
   */
  customDimensions?: Record<string, string>;
  
  /**
   * Custom metrics mapping
   */
  customMetrics?: Record<string, string>;
}

/**
 * Create GA4 provider instance
 */
function create(options: AnalyticsOptions): ProviderInstance {
  // Cast to GA4-specific options
  const ga4Options = options as GA4AnalyticsOptions;
  
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
  
  // Create client (pass debug flag from facade for debug endpoint)
  const client = new GA4Client({
    measurementId,
    apiSecret: options.apiSecret,
    transport: options.transport as any,
    customDimensions: ga4Options.customDimensions || {},
    customMetrics: ga4Options.customMetrics || {},
  }, options.debug); // Use debug endpoint if facade is in debug mode
  
  return {
    name: 'ga4',
    
    /**
     * Initialize provider
     */
    async _init() {
      logger.info('Initializing GA4 provider', {
        measurementId,
        transport: options.transport || 'beacon',
      });
    },
    
    /**
     * Track custom event
     */
    async track(name: string, props?: Props, url?: string, category?: string, pageContext?: PageContext) {
      // Map common trackkit events to GA4 events
      const mappedProps = mapTrackitPropsToGA4(name, props);

      // Let errors bubble up to facade
      await client.sendEvent(name, mappedProps, url, pageContext);
    },
    
    /**
     * Track pageview
     */
    async pageview(url?: string, pageContext?: PageContext) {
      // Let errors bubble up to facade
      await client.sendPageview(url, pageContext);
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
  },
};

export default ga4Provider;