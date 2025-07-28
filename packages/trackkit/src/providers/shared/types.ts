import type { PageContext, Props } from '../../types';

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
  sendEvent(eventName: string, props?: Props, url?: string, pageContext?: PageContext): Promise<void>;

  /**
   * Send a pageview event
   */
  sendPageview(url?: string, pageContext?: PageContext): Promise<void>;

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