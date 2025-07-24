import type { ProviderFactory, ProviderInstance } from '../types';
import type { AnalyticsOptions, Props } from '../../types';
import { GA4Client } from './client';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Parse GA4 measurement ID
 */
function parseMeasurementId(siteId?: string): string | null {
  if (!siteId) return null;
  
  // Accept various formats
  if (siteId.match(/^G-[A-Z0-9]+$/)) {
    return siteId;
  }
  
  // Try to extract from tag manager format
  const match = siteId.match(/G-[A-Z0-9]+/);
  return match ? match[0] : null;
}

/**
 * Create GA4 provider instance
 */
function create(options: AnalyticsOptions): ProviderInstance {
  // Validate configuration
  const measurementId = parseMeasurementId(options.siteId);
  if (!measurementId) {
    throw new AnalyticsError(
      'GA4 requires a valid measurement ID (G-XXXXXXXXXX)',
      'INVALID_CONFIG',
      'ga4'
    );
  }
  
  // Initialize client
  const client = new GA4Client({
    measurementId,
    debug: options.debug,
    apiSecret: options.apiSecret,
    transport: options.transport as any || 'beacon',
  });
  
  return {
    name: 'ga4',
    
    track(name: string, props?: Props, url?: string) {
      // Just send - consent already checked by facade
      const ga4EventName = mapEventName(name);
      const ga4Params = mapEventParams(ga4EventName, props);
      
      if (url) {
        ga4Params.page_location = url;
      }
      
      client.sendEvent(ga4EventName, ga4Params).catch(error => {
        logger.error('Failed to send GA4 event', error);
        options.onError?.(error);
      });
    },
    
    pageview(url?: string) {
      // Just send - consent already checked
      client.sendPageview(url).catch(error => {
        logger.error('Failed to send GA4 pageview', error);
        options.onError?.(error);
      });
    },
    
    identify(userId: string | null) {
      client.setUserId(userId);
    },
    
    destroy() {
      logger.debug('Destroying GA4 provider');
      if (typeof window !== 'undefined') {
        delete (window as any).gtag;
        delete (window as any).dataLayer;
      }
    },
  };
}

/**
 * Map generic event names to GA4 standard events
 */
function mapEventName(name: string): string {
  const mapping: Record<string, string> = {
    // Ecommerce
    'add_to_cart': 'add_to_cart',
    'remove_from_cart': 'remove_from_cart',
    'view_item': 'view_item',
    'view_cart': 'view_cart',
    'begin_checkout': 'begin_checkout',
    'purchase': 'purchase',
    'refund': 'refund',
    
    // Engagement
    'login': 'login',
    'sign_up': 'sign_up',
    'search': 'search',
    'share': 'share',
    
    // Content
    'select_content': 'select_content',
    'view_search_results': 'view_search_results',
  };
  
  return mapping[name.toLowerCase()] || name;
}

/**
 * Map event properties to GA4 parameters
 */
function mapEventParams(eventName: string, props?: Props): any {
  if (!props) return {};
  
  const params: any = {};
  
  // Map common properties
  if ('value' in props) params.value = props.value;
  if ('currency' in props) params.currency = props.currency;
  if ('search_term' in props) params.search_term = props.search_term;
  
  // Map ecommerce properties
  if (eventName.includes('cart') || eventName === 'purchase') {
    if ('items' in props) params.items = props.items;
    if ('item_id' in props) params.items = [{ item_id: props.item_id }];
  }
  
  // Pass through other properties
  Object.entries(props).forEach(([key, value]) => {
    if (!params[key] && typeof value !== 'object') {
      params[key] = value;
    }
  });
  
  return params;
}

/**
 * GA4 provider factory
 */
const ga4Provider: ProviderFactory = {
  create,
  meta: {
    name: 'ga4',
    version: '1.0.0',
  },
};

export default ga4Provider;