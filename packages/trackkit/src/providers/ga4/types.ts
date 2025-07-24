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
   * Enable enhanced measurement features
   * @default true
   */
  enhancedMeasurement?: boolean;
  
  /**
   * Custom dimensions mapping
   */
  customDimensions?: Record<string, string>;
  
  /**
   * Custom metrics mapping
   */
  customMetrics?: Record<string, string>;
  
  /**
   * Transport mechanism
   * @default 'beacon'
   */
  transport?: 'beacon' | 'xhr' | 'fetch';
}

/**
 * GA4 event parameters
 */
export interface GA4EventParams {
  // Standard parameters
  page_location?: string;
  page_referrer?: string;
  page_title?: string;
  screen_resolution?: string;
  user_id?: string;
  session_id?: string;
  engagement_time_msec?: number;
  
  // Enhanced measurement
  percent_scrolled?: number;
  search_term?: string;
  content_type?: string;
  content_id?: string;
  
  // Ecommerce
  currency?: string;
  value?: number;
  items?: GA4Item[];
  
  // Custom parameters
  [key: string]: any;
}

/**
 * GA4 item for ecommerce events
 */
export interface GA4Item {
  item_id: string;
  item_name: string;
  item_category?: string;
  item_variant?: string;
  price?: number;
  quantity?: number;
  currency?: string;
}

/**
 * gtag function interface
 */
export interface GtagFunction {
  (command: 'config', targetId: string, config?: any): void;
  (command: 'event', eventName: string, eventParams?: any): void;
  (command: 'set', params: any): void;
  (command: 'get', targetId: string, fieldName: string, callback: (value: any) => void): void;
}