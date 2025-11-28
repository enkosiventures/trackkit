import type { ConsentCategory, ConsentOptions, ResolvedConsentOptions } from './consent/types';
import type { DispatcherOptions, ResolvedDispatcherOptions } from './dispatcher/types';
import type { AnalyticsError } from './errors';
import type { GA4Options, ResolvedGA4Options } from './providers/ga4/types';
import type { NoopOptions, ResolvedNoopOptions } from './providers/noop/types';
import type { PlausibleOptions, ResolvedPlausibleOptions } from './providers/plausible/types';
import type { ResolvedUmamiOptions, UmamiOptions } from './providers/umami/types';


export type AnalyticsMode = 'singleton' | 'factory';


/**
 * Event properties - can be any JSON-serializable data
 */
export type Props = Record<string, unknown>;

/**
 * Event types
 */
// export type ArgsByType = {
//   track:    [name: string, props?: Props, url?: string];
//   pageview: [url?: string];
//   identify: [userId: string | null];
// };
// export type EventType = keyof ArgsByType;
export type EventType = 'track' | 'pageview' | 'identify';

/**
 * Analytics provider types
 */
export type ProviderType = 'noop' | 'umami' | 'plausible' | 'ga4';

// navigation source DI
export interface NavigationSource {
  /** Subscribe to normalized URL changes (pathname + search + hash). */
  subscribe(cb: (url: string) => void): () => void;
}

export interface ResolvedNavigationSource extends Required<NavigationSource> {}

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

/**
 * Analytics provider configuration options.
 * 
 * Specifies which analytics service to use and its configuration. TrackKit supports:
 * - **GA4**: Google Analytics 4 with measurement ID and optional custom dimensions
 * - **Plausible**: Privacy-focused analytics with domain configuration
 * - **Umami**: Self-hosted analytics with website ID  
 * - **Noop**: No-operation provider for testing or opt-out scenarios
 * 
 * Each provider has its own specific configuration requirements.
 */
export type ProviderOptions = 
  | NoopOptions
  | UmamiOptions
  | PlausibleOptions
  | GA4Options;

export type ResolvedProviderOptions = 
  | ResolvedNoopOptions
  | ResolvedUmamiOptions
  | ResolvedPlausibleOptions
  | ResolvedGA4Options;

/**
 * Core analytics facade configuration options.
 * 
 * These options control the behavior of the TrackKit facade layer - the part that
 * handles URL tracking, consent management, filtering, and coordination between
 * different analytics providers. These settings apply regardless of which specific
 * analytics provider you're using.
 * 
 * All properties are required when used internally, but become optional in 
 * AnalyticsOptions with sensible defaults applied.
 */
export interface FacadeOptions {

  /**
   * Enable page tracking when the page is hidden
   */
  allowWhenHidden: boolean;

  /**
   * Automatically track page views
   */
  autoTrack: boolean;

  /**
   * Enable cache-busting (ie disable caching) for requests
   */
  bustCache: boolean;

  /**
   * Enable debug logging to console
   */
  debug: boolean;

  /**
   * Whitelist of domains to track
   */
  domains?: string[];

  /**
   * Honor Do Not Track browser setting
   */
  doNotTrack: boolean;

  /**
   * Exclude paths from tracking
   */
  exclude?: string[];

  /**
   * Include hash in URL for hash-router SPAs that need it
   */
  includeHash: boolean;

  /**
   * Maximum number of events to queue before dropping oldest
   */
  queueSize: number;

  /**
   * Track localhost events
   */
  trackLocalhost: boolean;

  // OPTION COLLECTIONS

  /**
   * Custom consent options for GDPR compliance
   */
  consent?: ConsentOptions;

  /**
   * Navigation source for SPA URL change detection
   */
  navigationSource?: NavigationSource;

  // FUNCTION OPTIONS

  /**
   * Custom error handler for analytics errors
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
}

export interface ResolvedFacadeOptions extends Required<Omit<FacadeOptions,'consent'|'navigationSource'|'urlResolver'|'urlTransform'>> {
  consent: ResolvedConsentOptions;
  navigationSource: ResolvedNavigationSource;
  urlResolver?: () => string;
  urlTransform?: (url: string) => string;
}

/**
 * Configuration options for initializing the analytics system.
 * 
 * This is the main entry point for configuring TrackKit. It combines:
 * - **Facade options**: Core tracking behavior (autoTrack, domains, consent, etc.)
 * - **Provider options**: Analytics service configuration (GA4, Plausible, Umami)  
 * - **Dispatcher options**: Transport, batching, and resilience settings
 * 
 * All facade options are optional here and will use sensible defaults.
 * 
 * @example
 * ```typescript
 * const analytics = createAnalytics({
 *   provider: { name: 'ga4', measurementId: 'G-XXXXXXXXXX' },
 *   autoTrack: true,
 *   trackLocalhost: false,
 *   dispatcher: {
 *     batching: { enabled: true, maxSize: 10 }
 *   }
 * });
 * ```
 */
export interface AnalyticsOptions extends Partial<FacadeOptions> {
  /** Analytics provider configuration (GA4, Plausible, Umami, or noop) */
  provider?: ProviderOptions;
  /** Advanced transport, batching, and resilience configuration */
  dispatcher?: DispatcherOptions;
}

/**
 * Internal resolved configuration after applying defaults and validation.
 * 
 * This is the normalized shape used internally by the analytics facade after
 * processing user-provided AnalyticsOptions. All facade options are resolved
 * to concrete values, and provider options are validated and normalized.
 * 
 * @internal
 */
export interface ResolvedAnalyticsOptions {
  /** Fully resolved facade options with all defaults applied */
  facade: ResolvedFacadeOptions;
  /** Validated and normalized provider configuration */
  provider: ResolvedProviderOptions;
  /** Resolved dispatcher configuration */
  dispatcher: ResolvedDispatcherOptions;
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
  track(name: string, props?: Props, category?: ConsentCategory): void;

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
  track(name: string, props: Props, pageContext: PageContext): Promise<void>;
  /**
   * Track a page view
   * @param pageContext - Page context for the page view
   */
  pageview(pageContext: PageContext): Promise<void>;
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