import type { AnalyticsError } from './errors';

/**
 * Event properties - can be any JSON-serializable data
 */
export type Props = Record<string, unknown>;

/**
 * User consent state for GDPR compliance
 */
export type ConsentState = 'granted' | 'denied';

/**
 * Analytics provider types
 */
export type ProviderType = 'noop' | 'umami' | 'plausible' | 'ga';

/**
 * Configuration options for analytics initialization
 */
export interface AnalyticsOptions {
  /**
   * Analytics provider to use
   * @default 'noop'
   */
  provider?: ProviderType;
  
  /**
   * Provider-specific site/property ID
   * @example 'G-XXXXXXXXXX' for Google Analytics
   */
  siteId?: string;
  
  /**
   * Custom analytics host URL
   * @example 'https://analytics.example.com'
   */
  host?: string;
  
  /**
   * Maximum number of events to queue before dropping oldest
   * @default 50
   */
  queueSize?: number;
  
  /**
   * Enable debug logging to console
   * @default false
   */
  debug?: boolean;
  
  /**
   * Number of events to batch together
   * @default 10
   */
  batchSize?: number;
  
  /**
   * Time in ms before forcing batch send
   * @default 1000
   */
  batchTimeout?: number;

  /**
   * Custom error handler for analytics errors
   * @default console.error
   */
  onError?: (error: AnalyticsError) => void;
}

/**
 * Analytics instance methods
 */
export interface AnalyticsInstance {
  /**
   * Track a custom event
   * @param name - Event name (e.g., 'button_click')
   * @param props - Optional event properties
   * @param url - Optional URL override
   */
  track(name: string, props?: Props, url?: string): void;
  
  /**
   * Track a page view
   * @param url - Optional URL override (defaults to current page)
   */
  pageview(url?: string): void;
  
  /**
   * Identify the current user
   * @param userId - User identifier or null to clear
   */
  identify(userId: string | null): void;
  
  /**
   * Update user consent state
   * @param state - 'granted' or 'denied'
   */
  setConsent(state: ConsentState): void;
  
  /**
   * Clean up and destroy the instance
   */
  destroy(): void;
}

/**
 * Internal provider lifecycle state
 */
export type ProviderState = 'idle' | 'initializing' | 'ready' | 'destroyed';