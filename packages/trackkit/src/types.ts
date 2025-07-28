import { ConsentOptions } from './consent/types';
import type { AnalyticsError } from './errors';

/**
 * Event types
 */
export type EventType = 'track' | 'pageview' | 'identify';

/**
 * Event properties - can be any JSON-serializable data
 */
export type Props = Record<string, unknown>;

/**
 * Analytics provider types
 */
export type ProviderType = 'noop' | 'umami' | 'plausible' | 'ga';

// navigation source DI
export interface NavigationSource {
  /** Subscribe to normalized URL changes (pathname + search + hash). */
  subscribe(cb: (url: string) => void): () => void;
}

/** 
 * Page-level context computed by the facade at send-time. */
export interface PageContext {
  /** Normalized, masked URL to report (pathname+search+hash). */
  url: string;

  /** Current document title (optional). */
  title?: string;

  /**
   * Referrer to report:
   * - first pageview: document.referrer (external only, after your policy)
   * - SPA navigations: previous same-origin URL, or '' if none/app policy strips
   */
  referrer?: string;

  /** Viewport size in CSS pixels at send-time. */
  viewportSize?: { width: number; height: number };

  /** Screen size in CSS pixels at send-time. */
  screenSize?: { width: number; height: number };

  /**
   * Language of the browser at send-time.
   * Useful for providers that support localization.
   */
  language?: string;

  /**
   * When the facade created this context (ms since epoch).
   * Helps providers that batch or order events.
   */
  timestamp?: number;

  /**
   * Optional bag for future, strictly provider-agnostic additions (e.g., language).
   * Avoid PII; keep this small to preserve a stable ABI.
   */
  meta?: Readonly<Record<string, unknown>>;
}

/** Optional context for custom events; identical today for simplicity. */
export type EventContext = PageContext;


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
   * Automatically track page views
   * @default true
   */
  autoTrack?: boolean;

  /**
   * Honor Do Not Track browser setting
   * @default true
   */
  doNotTrack?: boolean;

  /**
   * Whitelist of domains to track
   */
  domains?: string[];

  /**
   * Enable caching for requests
   * @default true
   */
  cache?: boolean;

  /**
   * Enable page tracking when the page is hidden
   * @default false
   */
  allowWhenHidden?: boolean;

  /**
   * Custom API secret for server-side tracking
   * Required for providers that support server-side events
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
   * Transport mechanism for sending events
   * @default 'beacon'
   */
  transport?: 'beacon' | 'xhr' | 'fetch';

  /**
   * Hash mode for Plausible (SPAs)
   */
  hashMode?: boolean;

  /**
   * Track localhost events (Plausible)
   * @default false
   */
  trackLocalhost?: boolean;
  
  /**
   * Exclude paths from tracking (Plausible)
   */
  exclude?: string[];
  
  /**
   * Default properties for all events (Plausible)
   */
  defaultProps?: Record<string, string>;
  
  /**
   * Revenue tracking configuration (Plausible)
   */
  revenue?: {
    currency: string;
    trackingEnabled: boolean;
  };

  /**
   * Custom consent options for GDPR compliance
   */
  consent?: ConsentOptions;

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
  name: string;
  /**
   * Track a custom event
   * @param name - Event name (e.g., 'button_click')
   * @param props - Optional event properties
   * @param url - Optional URL override
   * @param category - Optional event category for grouping
   * @param ctx - Optional page context for the event
   */
  track(name: string, props?: Props, url?: string, category?: string, pageContext?: PageContext): void;

  /**
   * Track a page view
   * @param url - Optional URL override (defaults to current page)
   * @param pageContext - Optional page context for the event
   */
  pageview(url?: string, pageContext?: PageContext): void;
  
  /**
   * Identify the current user
   * @param userId - User identifier or null to clear
   */
  identify(userId: string | null): void;
  
  /**
   * Clean up and destroy the instance
   */
  destroy(): void;
}
