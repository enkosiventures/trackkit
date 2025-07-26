import type { Props } from '../../types';

/**
 * Base configuration for all analytics clients
 */
export interface BaseClientConfig {
  /**
   * Enable debug logging
   */
  debug?: boolean;
  
  /**
   * Error callback
   */
  onError?: (error: Error) => void;
}

/**
 * Common browser data collected by all providers
 */
export interface BrowserData {
  url: string;
  referrer: string;
  title: string;
  viewport: {
    width: number;
    height: number;
  };
  screen: {
    width: number;
    height: number;
  };
  language: string;
}

/**
 * HTTP transport options
 */
export interface TransportOptions {
  method?: 'GET' | 'POST';
  headers?: Record<string, string>;
  body?: any;
  keepalive?: boolean;
  timeout?: number;
}

/**
 * Base analytics client interface
 */
export interface BaseAnalyticsClient {
  /**
   * Send an event to the analytics service
   */
  sendEvent(eventName: string, props?: Props, url?: string): Promise<void>;
  
  /**
   * Send a pageview event
   */
  sendPageview(url?: string, title?: string): Promise<void>;
  
  /**
   * Identify a user (if supported)
   */
  identify?(userId: string | null): void;
  
  /**
   * Clean up resources
   */
  destroy?(): void;
}

/**
 * Navigation change handler
 */
export type NavigationHandler = (url: string) => void;

/**
 * Common validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
  parsed?: any;
}