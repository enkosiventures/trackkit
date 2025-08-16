import { ConsentCategory, ConsentOptions } from './consent/types';
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
export type ProviderType = 'noop' | 'umami' | 'plausible' | 'ga4';

// navigation source DI
export interface NavigationSource {
  /** Subscribe to normalized URL changes (pathname + search + hash). */
  subscribe(cb: (url: string) => void): () => void;
}

/** 
 * Page-level context computed by the facade at send-time.
 * */
export interface PageContext {
  /** Normalized, masked URL to report (pathname+search+hash). */
  url: string;

  /** Current document title (optional). */
  title?: string;

  /** Hostname of the page (e.g., 'example.com'). */
  hostname?: string;

  /**
   * Referrer to report:
   * - first pageview: document.referrer (external only, after your policy)
   * - SPA navigations: previous same-origin URL, or '' if none/app policy strips
   */
  referrer?: string;

  /**
   * User identifier to report.
   * This is optional; many providers don’t support it.
   * If provided, it should be a stable, anonymized user ID.
   */
  userId?: string;

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

// ---- Facade-only options (always honored, even on noop fallback)
export type InitOptions = {
  /**
   * Analytics provider type
   * @default 'noop'
   * @example 'umami', 'plausible', 'ga4'
   */
  provider?: ProviderType;

  /**
   * Generic alias for provider-specific site/property ID
   * @example 'G-XXXXXXXXXX' for Google Analytics
   */
  site?: string;

  /**
   * Custom analytics host URL
   * @example 'https://analytics.example.com'
   */
  host?: string;

  /**
   * Maximum number of events to queue before dropping oldest
   * @default 50
   */
  queueSize?: number;          // default 50

  /**
   * Number of events to batch together
   * @default 10
   */
  batchSize?: number;          // default 10

  /**
   * Time in ms before forcing batch send
   * @default 1000
   */
  batchTimeout?: number;       // default 1000

  /**
   * Enable debug logging to console
   * @default false
   */
  debug?: boolean;

  /**
   * Transport mechanism for sending events
   * @default 'beacon'
   */
  transport?: 'auto' | 'beacon' | 'fetch' | 'xhr';

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
   * Automatically track page views
   * @default true
   */
  autoTrack?: boolean;         // default true

  /**
   * Honor Do Not Track browser setting
   * @default true
   */
  doNotTrack?: boolean;        // default true

  /**
   * Track localhost events (Plausible)
   * @default false
   */
  trackLocalhost?: boolean;    // default false

  /**
   * Whitelist of domains to track
   */
  domains?: string[];

  /**
   * Exclude paths from tracking (Plausible)
   */
  exclude?: string[];

  /**
   * Include hash in URL for hash-router SPAs that need it
   */
  includeHash?: boolean;

  /**
   * Custom consent options for GDPR compliance
   */
  consent?: ConsentOptions;

  /**
   * Default properties for all events (Plausible)
   */
  defaultProps?: Record<string, string>;

  /**
   * Custom error handler for analytics errors
   * @default console.error
   */
  onError?: (error: AnalyticsError) => void;

  /**
   * Provide a custom way to resolve the current URL. Default derives from window.location.
   */
  urlResolver?: () => string;

  /**
   * Transform the resolved URL (e.g., strip PII tokens) before dedupe/exclusions.
   */
  urlTransform?: (url: string) => string;

  navigationSource?: NavigationSource;


  // Umami-specific options
  /**
   * Umami website ID
   * @example '9e1e6d6e-7c0e-4b0e-8f0a-5c5b5b5b5b5b'
   */
  website?: string;


  // Plausible-specific options
  /**
   * Plausible domain to track
   * @example 'example.com'
   */
  domain?: string;

  /**
   * Revenue tracking configuration (Plausible)
   */
  revenue?: { currency: string; trackingEnabled: boolean };


  // GA4-specific options
  /**
   * Google Analytics 4 measurement ID
   * @example 'G-XXXXXXXXXX'
   */
  measurementId?: string;

  /**
   * Custom API secret for server-side tracking
   * Required for providers that support server-side events
   */
  apiSecret?: string;

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
   * Send to GA validation endpoint (/debug/mp/collect).
   * @default false
   */
  debugEndpoint?: boolean;

  /**
   * Add GA4 `debug_mode=1` event param so events show in DebugView.
   * @default false
   */
  debugMode?: boolean;
}

export interface FacadeOptions {
  debug: boolean;
  queueSize: number;
  batchSize: number;
  batchTimeout: number;
  autoTrack: boolean;
  doNotTrack: boolean;
  trackLocalhost: boolean;
  cache: boolean;
  allowWhenHidden: boolean;
  includeHash: boolean;
  domains?: string[];
  exclude?: string[];
  transport: 'auto' |'beacon' | 'xhr' | 'fetch';
  consent?: ConsentOptions;
  navigationSource?: NavigationSource;
  onError?: (error: AnalyticsError) => void;
  urlResolver?: () => string;
  urlTransform?: (url: string) => string;
}

/** Normalized alias: accept `site` at input, but canonicalize below and drop `site`. */
// export type NoopOptions = ProviderBase;
export type NoopOptions = {
  provider: 'noop' 
  site?: string;
  host?: string;
};

export type UmamiOptions = {
  provider: 'umami';
  site?: string;
  website: string;
  host?: string;
};

export type PlausibleOptions =  {
  provider: 'plausible';
  site?: string;
  domain: string;
  host?: string;
  revenue?: { currency: string; trackingEnabled: boolean };
};

export type GA4Options = {
  provider: 'ga4';
  site?: string;
  measurementId: string;
  apiSecret?: string;
  customDimensions?: Record<string, string>;
  customMetrics?: Record<string, string>;
  host?: string;
  debugEndpoint?: boolean;
  debugMode?: boolean;
};

// ---- Final input type
export type ProviderOptions = NoopOptions | UmamiOptions | PlausibleOptions | GA4Options;


// Internal resolved shape
export interface ResolvedOptions {
  facadeOptions: FacadeOptions;
  providerOptions: ProviderOptions;
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
   * @param category - Optional event category for grouping (defaults to 'analytics')
   */
  track(name: string, props?: Props, category?: string): void;

  /**
   * Track a page view
   */
  pageview(): void;
  
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

export interface ProviderInstance {
  name: string;
  /**
   * Track a custom event
   * @param name - Event name (e.g., 'button_click')
   * @param props - List of event properties (may be empty)
   * @param pageContext - Page context for the event
   */
  track(name: string, props: Props, pageContext: PageContext): void;
  /**
   * Track a page view
   * @param pageContext - Page context for the page view
   */
  pageview(pageContext: PageContext): void;
  /**
   * Identify the current user
   * @param userId - User identifier or null to clear
   * @param pageContext - Page context for the identification event
   */
  identify(userId: string | null, pageContext: PageContext): void;
  /**
   * Clean up and destroy the instance
   */
  destroy(): void;
}