import type { BaseClientConfig } from '../shared/types';

/**
 * GA4 configuration options
 */
export interface GA4Config {
  /**
   * Google Analytics Measurement ID
   * @example 'G-XXXXXXXXXX'
   */
  measurementId: string;
  
  /**
   * Send events to debug endpoint
   * @default false
   */
  debug?: boolean;
  
  /**
   * Custom API secret for Measurement Protocol
   * Required for server-side tracking
   */
  apiSecret?: string;
  
  /**
   * Session timeout in minutes
   * @default 30
   */
  sessionTimeout?: number;
  
  /**
   * Custom dimensions mapping
   * Maps friendly names to GA4 dimension names
   * @example { plan_type: 'custom_dimension_1' }
   */
  customDimensions?: Record<string, string>;
  
  /**
   * Custom metrics mapping
   * Maps friendly names to GA4 metric names
   * @example { engagement_score: 'custom_metric_1' }
   */
  customMetrics?: Record<string, string>;
  
  /**
   * Transport mechanism
   * @default 'beacon'
   */
  transport?: 'beacon' | 'xhr' | 'fetch';
  
  /**
   * Error callback
   */
  onError?: (error: Error) => void;
}

/**
 * Internal GA4 client configuration
 */
export interface GA4ClientConfig extends BaseClientConfig, Required<Omit<GA4Config, 'onError'>> {
  // Inherits debug and onError from BaseClientConfig
}

/**
 * GA4 event parameters
 */
export interface GA4EventParams {
  // Required parameters
  session_id?: string;
  engagement_time_msec?: number;
  
  // Page parameters
  page_location?: string;
  page_referrer?: string;
  page_title?: string;
  page_path?: string;
  
  // User parameters
  user_id?: string;
  user_properties?: Record<string, any>;
  
  // Device/platform parameters
  screen_resolution?: string;
  language?: string;
  
  // Enhanced measurement
  percent_scrolled?: number;
  search_term?: string;
  content_type?: string;
  content_id?: string;
  content_group?: string;
  
  // Engagement
  engaged_session_event?: 1;
  
  // Ecommerce parameters
  currency?: string;
  value?: number;
  coupon?: string;
  payment_type?: string;
  items?: GA4Item[];
  
  // Event-specific parameters
  method?: string;
  
  // Custom parameters
  [key: string]: any;
}

/**
 * GA4 item for ecommerce events
 */
export interface GA4Item {
  // Required
  item_id: string;
  item_name: string;
  
  // Optional
  affiliation?: string;
  coupon?: string;
  currency?: string;
  discount?: number;
  index?: number;
  item_brand?: string;
  item_category?: string;
  item_category2?: string;
  item_category3?: string;
  item_category4?: string;
  item_category5?: string;
  item_list_id?: string;
  item_list_name?: string;
  item_variant?: string;
  location_id?: string;
  price?: number;
  quantity?: number;
  
  // Custom item parameters
  [key: string]: any;
}

/**
 * GA4 Measurement Protocol response
 */
export interface GA4DebugResponse {
  validationMessages: Array<{
    fieldPath: string;
    description: string;
    validationCode: string;
  }>;
}

/**
 * Standard GA4 events
 */
export type GA4StandardEvent = 
  // Automatically collected events
  | 'first_visit'
  | 'session_start'
  | 'page_view'
  | 'user_engagement'
  | 'scroll'
  | 'click'
  | 'view_search_results'
  | 'video_start'
  | 'video_progress'
  | 'video_complete'
  | 'file_download'
  
  // Recommended events - Retail/Ecommerce
  | 'add_payment_info'
  | 'add_shipping_info'
  | 'add_to_cart'
  | 'add_to_wishlist'
  | 'begin_checkout'
  | 'generate_lead'
  | 'purchase'
  | 'refund'
  | 'remove_from_cart'
  | 'select_item'
  | 'select_promotion'
  | 'view_cart'
  | 'view_item'
  | 'view_item_list'
  | 'view_promotion'
  
  // Recommended events - Games
  | 'earn_virtual_currency'
  | 'join_group'
  | 'level_end'
  | 'level_start'
  | 'level_up'
  | 'post_score'
  | 'select_content'
  | 'spend_virtual_currency'
  | 'tutorial_begin'
  | 'tutorial_complete'
  | 'unlock_achievement'
  
  // Other recommended events
  | 'ad_impression'
  | 'exception'
  | 'login'
  | 'search'
  | 'share'
  | 'sign_up';