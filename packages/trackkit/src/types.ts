// import type { ConsentCategory, ConsentOptions, ResolvedConsentOptions } from './consent/types';
// import type { DispatcherOptions, ResolvedDispatcherOptions } from './dispatcher/types';
// import type { AnalyticsError } from './errors';
// import type { GA4Options, ResolvedGA4Options } from './providers/ga4/types';
// import type { NoopOptions, ResolvedNoopOptions } from './providers/noop/types';
// import type { PlausibleOptions, ResolvedPlausibleOptions } from './providers/plausible/types';
// import type { ResolvedUmamiOptions, UmamiOptions } from './providers/umami/types';


// export type AnalyticsMode = 'singleton' | 'factory';


// /**
//  * Event properties - can be any JSON-serializable data
//  */
// export type Props = Record<string, unknown>;

// /**
//  * Event types
//  */
// // export type ArgsByType = {
// //   track:    [name: string, props?: Props, url?: string];
// //   pageview: [url?: string];
// //   identify: [userId: string | null];
// // };
// // export type EventType = keyof ArgsByType;
// export type EventType = 'track' | 'pageview' | 'identify';

// /**
//  * Analytics provider types
//  */
// export type ProviderType = 'noop' | 'umami' | 'plausible' | 'ga4';

// // navigation source DI
// export interface NavigationSource {
//   /** Subscribe to normalized URL changes (pathname + search + hash). */
//   subscribe(cb: (url: string) => void): () => void;
// }

// export interface ResolvedNavigationSource extends Required<NavigationSource> {}

// /** 
//  * Page-level context computed by the facade at send-time.
//  * */
// export interface PageContext {
//   /** Normalized, masked URL to report (pathname+search+hash). */
//   url: string;

//   /** Current document title (optional). */
//   title?: string;

//   /** Hostname of the page (e.g., 'example.com'). */
//   hostname?: string;

//   /**
//    * Referrer to report:
//    * - first pageview: document.referrer (external only, after your policy)
//    * - SPA navigations: previous same-origin URL, or '' if none/app policy strips
//    */
//   referrer?: string;

//   /**
//    * User identifier to report.
//    * This is optional; many providers don’t support it.
//    * If provided, it should be a stable, anonymized user ID.
//    */
//   userId?: string;

//   /** Viewport size in CSS pixels at send-time. */
//   viewportSize?: { width: number; height: number };

//   /** Screen size in CSS pixels at send-time. */
//   screenSize?: { width: number; height: number };

//   /**
//    * Language of the browser at send-time.
//    * Useful for providers that support localization.
//    */
//   language?: string;

//   /**
//    * When the facade created this context (ms since epoch).
//    * Helps providers that batch or order events.
//    */
//   timestamp?: number;

//   /**
//    * Optional bag for future, strictly provider-agnostic additions (e.g., language).
//    * Avoid PII; keep this small to preserve a stable ABI.
//    */
//   meta?: Readonly<Record<string, unknown>>;
// }

// /** Optional context for custom events; identical today for simplicity. */
// export type EventContext = PageContext;

// /**
//  * Analytics provider configuration options.
//  * 
//  * Specifies which analytics service to use and its configuration. TrackKit supports:
//  * - **GA4**: Google Analytics 4 with measurement ID and optional custom dimensions
//  * - **Plausible**: Privacy-focused analytics with domain configuration
//  * - **Umami**: Self-hosted analytics with website ID  
//  * - **Noop**: No-operation provider for testing or opt-out scenarios
//  * 
//  * Each provider has its own specific configuration requirements.
//  */
// export type ProviderOptions = 
//   | NoopOptions
//   | UmamiOptions
//   | PlausibleOptions
//   | GA4Options;

// export type ResolvedProviderOptions = 
//   | ResolvedNoopOptions
//   | ResolvedUmamiOptions
//   | ResolvedPlausibleOptions
//   | ResolvedGA4Options;

// /**
//  * Core analytics facade configuration options.
//  * 
//  * These options control the behavior of the TrackKit facade layer - the part that
//  * handles URL tracking, consent management, filtering, and coordination between
//  * different analytics providers. These settings apply regardless of which specific
//  * analytics provider you're using.
//  * 
//  * All properties are required when used internally, but become optional in 
//  * AnalyticsOptions with sensible defaults applied.
//  */
// export interface FacadeOptions {

//   /**
//    * Enable page tracking when the page is hidden
//    */
//   allowWhenHidden: boolean;

//   /**
//    * Automatically track page views
//    */
//   autoTrack: boolean;

//   /**
//    * Enable cache-busting (ie disable caching) for requests
//    */
//   bustCache: boolean;

//   /**
//    * Enable debug logging to console
//    */
//   debug: boolean;

//   /**
//    * Whitelist of domains to track
//    */
//   domains?: string[];

//   /**
//    * Honor Do Not Track browser setting
//    */
//   doNotTrack: boolean;

//   /**
//    * Exclude paths from tracking
//    */
//   exclude?: string[];

//   /**
//    * Include hash in URL for hash-router SPAs that need it
//    */
//   includeHash: boolean;

//   /**
//    * Maximum number of events to queue before dropping oldest
//    */
//   queueSize: number;

//   /**
//    * Track localhost events
//    */
//   trackLocalhost: boolean;

//   // OPTION COLLECTIONS

//   /**
//    * Custom consent options for GDPR compliance
//    */
//   consent?: ConsentOptions;

//   /**
//    * Navigation source for SPA URL change detection
//    */
//   navigationSource?: NavigationSource;

//   // FUNCTION OPTIONS

//   /**
//    * Custom error handler for analytics errors
//    */
//   onError?: (error: AnalyticsError) => void;

//   /**
//    * Provide a custom way to resolve the current URL. Default derives from window.location.
//    */
//   urlResolver?: () => string;

//   /**
//    * Transform the resolved URL (e.g., strip PII tokens) before dedupe/exclusions.
//    */
//   urlTransform?: (url: string) => string;
// }

// export interface ResolvedFacadeOptions extends Required<Omit<FacadeOptions,'consent'|'navigationSource'|'urlResolver'|'urlTransform'>> {
//   consent: ResolvedConsentOptions;
//   navigationSource: ResolvedNavigationSource;
//   urlResolver?: () => string;
//   urlTransform?: (url: string) => string;
// }

// /**
//  * Configuration options for initializing the analytics system.
//  * 
//  * This is the main entry point for configuring TrackKit. It combines:
//  * - **Facade options**: Core tracking behavior (autoTrack, domains, consent, etc.)
//  * - **Provider options**: Analytics service configuration (GA4, Plausible, Umami)  
//  * - **Dispatcher options**: Transport, batching, and resilience settings
//  * 
//  * All facade options are optional here and will use sensible defaults.
//  * 
//  * @example
//  * ```typescript
//  * const analytics = createAnalytics({
//  *   provider: { name: 'ga4', measurementId: 'G-XXXXXXXXXX' },
//  *   autoTrack: true,
//  *   trackLocalhost: false,
//  *   dispatcher: {
//  *     batching: { enabled: true, maxSize: 10 }
//  *   }
//  * });
//  * ```
//  */
// export interface AnalyticsOptions extends Partial<FacadeOptions> {
//   /** Analytics provider configuration (GA4, Plausible, Umami, or noop) */
//   provider?: ProviderOptions;
//   /** Advanced transport, batching, and resilience configuration */
//   dispatcher?: DispatcherOptions;
// }

// /**
//  * Internal resolved configuration after applying defaults and validation.
//  * 
//  * This is the normalized shape used internally by the analytics facade after
//  * processing user-provided AnalyticsOptions. All facade options are resolved
//  * to concrete values, and provider options are validated and normalized.
//  * 
//  * @internal
//  */
// export interface ResolvedAnalyticsOptions {
//   /** Fully resolved facade options with all defaults applied */
//   facade: ResolvedFacadeOptions;
//   /** Validated and normalized provider configuration */
//   provider: ResolvedProviderOptions;
//   /** Resolved dispatcher configuration */
//   dispatcher: ResolvedDispatcherOptions;
// }

// /**
//  * Analytics instance methods
//  */
// export interface AnalyticsInstance {
//   name: string;
//   /**
//    * Track a custom event
//    * @param name - Event name (e.g., 'button_click')
//    * @param props - Optional event properties
//    * @param category - Optional event category for grouping (defaults to 'analytics')
//    */
//   track(name: string, props?: Props, category?: ConsentCategory): void;

//   /**
//    * Track a page view
//    */
//   pageview(): void;
  
//   /**
//    * Identify the current user
//    * @param userId - User identifier or null to clear
//    */
//   identify(userId: string | null): void;
  
//   /**
//    * Clean up and destroy the instance
//    */
//   destroy(): void;
// }

// export interface ProviderInstance {
//   name: string;
//   /**
//    * Track a custom event
//    * @param name - Event name (e.g., 'button_click')
//    * @param props - List of event properties (may be empty)
//    * @param pageContext - Page context for the event
//    */
//   track(name: string, props: Props, pageContext: PageContext): Promise<void>;
//   /**
//    * Track a page view
//    * @param pageContext - Page context for the page view
//    */
//   pageview(pageContext: PageContext): Promise<void>;
//   /**
//    * Identify the current user
//    * @param userId - User identifier or null to clear
//    * @param pageContext - Page context for the identification event
//    */
//   identify(userId: string | null, pageContext: PageContext): void;
//   /**
//    * Clean up and destroy the instance
//    */
//   destroy(): void;
// }

// src/types.ts
import type {
  ConsentCategory,
  ConsentOptions,
  ResolvedConsentOptions,
} from './consent/types';
import type {
  DispatcherOptions,
  ResolvedDispatcherOptions,
} from './dispatcher/types';
import type { AnalyticsError } from './errors';
import type {
  GA4Options,
  ResolvedGA4Options,
} from './providers/ga4/types';
import type {
  NoopOptions,
  ResolvedNoopOptions,
} from './providers/noop/types';
import type {
  PlausibleOptions,
  ResolvedPlausibleOptions,
} from './providers/plausible/types';
import type {
  ResolvedUmamiOptions,
  UmamiOptions,
} from './providers/umami/types';

/**
 * How the analytics facade is instantiated.
 *
 * - `'singleton'` – default mode; Trackkit manages a shared global instance.
 * - `'factory'` – you construct and own individual instances manually.
 *
 * This is currently mostly informational in the types and docs; the public
 * API is centred around the singleton helper.
 */
export type AnalyticsMode = 'singleton' | 'factory';

/**
 * Generic bag of event properties.
 *
 * Props must be JSON-serialisable. For stricter typing you can layer a
 * project-specific type over this in your own code.
 */
export type Props = Record<string, unknown>;

/**
 * Supported high-level analytics operations.
 *
 * These map to facade methods and provider instance methods.
 */
export type EventType = 'track' | 'pageview' | 'identify';

/**
 * Built-in analytics provider identifiers.
 *
 * - `'noop'`      – no-op provider; useful for testing or opt-out.
 * - `'umami'`     – Umami analytics.
 * - `'plausible'` – Plausible Analytics.
 * - `'ga4'`       – Google Analytics 4 (Measurement Protocol).
 */
export type ProviderType = 'noop' | 'umami' | 'plausible' | 'ga4';

/**
 * Abstraction for SPA/router navigation sources.
 *
 * You can plug in your own router adapter (e.g. React Router, Vue Router)
 * by implementing this interface and passing it via
 * {@link FacadeOptions.navigationSource}.
 */
export interface NavigationSource {
  /**
   * Subscribe to normalised URL changes (pathname + search + hash).
   *
   * The callback is invoked whenever the current logical page changes.
   * Returns an unsubscribe function which should detach any listeners you
   * register.
   */
  subscribe(cb: (url: string) => void): () => void;
}

/**
 * Internal resolved navigation source with all fields required.
 *
 * @internal
 */
export interface ResolvedNavigationSource extends Required<NavigationSource> {}

/**
 * Page-level context computed by the facade at send-time.
 *
 * This is the canonical representation of “where and when” an event
 * happened. Providers derive their own payloads from this.
 */
export interface PageContext {
  /**
   * Normalised, masked URL to report (pathname + search + hash).
   *
   * Any PII-stripping and hash/router normalisation should already have
   * been applied (see {@link FacadeOptions.urlTransform}).
   */
  url: string;

  /** Current document title, if available. */
  title?: string;

  /** Hostname of the page (e.g. `"example.com"`). */
  hostname?: string;

  /**
   * Referrer to report.
   *
   * - First pageview: the external referrer (e.g. `document.referrer`)
   *   after your policy has stripped/normalised it.
   * - SPA navigations: previous same-origin URL, or `''` if none or if
   *   your policy removes it.
   */
  referrer?: string;

  /**
   * Application-level user identifier.
   *
   * This is optional; many providers don’t support user IDs in a
   * privacy-preserving way. If you set it, prefer a stable, anonymised ID.
   */
  userId?: string;

  /** Viewport size in CSS pixels at send-time. */
  viewportSize?: { width: number; height: number };

  /** Screen size in CSS pixels at send-time. */
  screenSize?: { width: number; height: number };

  /**
   * Browser language at send-time.
   *
   * Typically derived from `navigator.language`.
   */
  language?: string;

  /**
   * When the facade created this context (ms since epoch).
   *
   * Used by some providers and internal diagnostics for ordering and timing.
   */
  timestamp?: number;

  /**
   * Optional bag for future, provider-agnostic additions.
   *
   * Avoid PII; keep this small to preserve a stable ABI. Provider-specific
   * fields should *not* go here – they belong in the provider payload.
   */
  meta?: Readonly<Record<string, unknown>>;
}

/**
 * Optional context for custom events.
 *
 * Currently identical to {@link PageContext}; kept separate so the types
 * can diverge in the future without breaking callers.
 */
export type EventContext = PageContext;

/**
 * Analytics provider configuration options.
 *
 * Specifies which analytics service to use and how it should be configured.
 * Trackkit ships with first-class support for:
 *
 * - {@link GA4Options | GA4}: Google Analytics 4
 * - {@link PlausibleOptions | Plausible}: Plausible Analytics
 * - {@link UmamiOptions | Umami}: Umami analytics
 * - {@link NoopOptions | Noop}: no-op provider
 *
 * Each provider has its own specific requirements (e.g. measurement ID,
 * domain, website ID).
 */
export type ProviderOptions =
  | NoopOptions
  | UmamiOptions
  | PlausibleOptions
  | GA4Options;

/**
 * Internal, normalised provider options.
 *
 * Providers use these shapes after validation and defaulting has been
 * applied. External callers should stick to {@link ProviderOptions}.
 *
 * @internal
 */
export type ResolvedProviderOptions =
  | ResolvedNoopOptions
  | ResolvedUmamiOptions
  | ResolvedPlausibleOptions
  | ResolvedGA4Options;

/**
 * Core analytics facade configuration options.
 *
 * These control the behaviour of the Trackkit facade layer – the piece that
 * manages:
 *
 * - URL resolution and normalisation
 * - consent and policy gating
 * - queueing and dedupe
 * - navigation integration
 *
 * They apply regardless of which concrete {@link ProviderOptions | provider}
 * you configure.
 *
 * All fields are required in the internal {@link ResolvedFacadeOptions};
 * callers use them via {@link AnalyticsOptions}, where everything is
 * optional with sensible defaults.
 */
export interface FacadeOptions {
  /**
   * Whether to allow tracking when the document is hidden.
   *
   * When `false`, events may be skipped while the tab is backgrounded to
   * avoid noisy data.
   */
  allowWhenHidden: boolean;

  /**
   * Automatically track page views.
   *
   * When `true`, navigation events detected by the facade will emit
   * `pageview()` calls without you needing to call them manually.
   */
  autoTrack: boolean;

  /**
   * Enable cache-busting for provider HTTP requests.
   *
   * When `true`, Trackkit adds query params / headers to avoid accidental
   * caching of analytics requests.
   */
  bustCache: boolean;

  /**
   * Enable debug logging to the console.
   *
   * When `true`, the facade and dispatcher emit verbose logs under a
   * Trackkit-specific logger namespace.
   */
  debug: boolean;

  /**
   * Whitelist of domains to track.
   *
   * If set, only events whose hostname matches one of these entries will
   * be sent.
   */
  domains?: string[];

  /**
   * Honour the browser’s “Do Not Track” setting.
   *
   * When `true` and DNT is enabled, non-essential events will be blocked
   * by policy.
   */
  doNotTrack: boolean;

  /**
   * Exclude paths from tracking.
   *
   * Typically used for admin routes or internal tools. Matching happens
   * against the resolved URL; see the docs for matching semantics.
   */
  exclude?: string[];

  /**
   * Include the URL hash fragment when computing the reporting URL.
   *
   * Useful for hash-based SPAs that encode route state in `#...`.
   */
  includeHash: boolean;

  /**
   * Maximum number of events to hold in the in-memory queue.
   *
   * When this limit is exceeded, oldest events are dropped first.
   */
  queueSize: number;

  /**
   * Whether to track events on `localhost` and similar development hosts.
   */
  trackLocalhost: boolean;

  // OPTION COLLECTIONS

  /**
   * Consent configuration and defaults.
   *
   * Controls how consent categories map to providers and how the policy
   * gate behaves. See {@link ConsentOptions}.
   */
  consent?: ConsentOptions;

  /**
   * Navigation source for SPA URL change detection.
   *
   * When omitted, Trackkit falls back to a basic `popstate` / `hashchange`
   * listener, which works well for many SPAs but can be overridden with
   * router-specific integration.
   */
  navigationSource?: NavigationSource;

  // FUNCTION OPTIONS

  /**
   * Custom error handler for analytics errors.
   *
   * Defaults to a console-based handler. You can integrate this with your
   * own error reporting (Sentry, etc).
   */
  onError?: (error: AnalyticsError) => void;

  /**
   * Provide a custom way to resolve the current URL.
   *
   * When omitted, the facade derives it from `window.location`. This is
   * typically only needed in SSR or highly customised routing setups.
   */
  urlResolver?: () => string;

  /**
   * Transform the resolved URL before it is used for:
   * - de-duplication,
   * - exclusions,
   * - and provider payloads.
   *
   * Common use cases:
   * - stripping PII tokens from query params,
   * - normalising trailing slashes,
   * - collapsing noisy routes.
   */
  urlTransform?: (url: string) => string;
}

/**
 * Fully-resolved facade configuration with defaults applied.
 *
 * This is the internal shape used after configuration merging.
 *
 * @internal
 */
export interface ResolvedFacadeOptions
  extends Required<
    Omit<
      FacadeOptions,
      'consent' | 'navigationSource' | 'urlResolver' | 'urlTransform'
    >
  > {
  consent: ResolvedConsentOptions;
  navigationSource: ResolvedNavigationSource;
  urlResolver?: () => string;
  urlTransform?: (url: string) => string;
}

/**
 * Configuration options for initialising the analytics system.
 *
 * This is the main entry point for configuring Trackkit. It combines:
 *
 * - {@link FacadeOptions | facade options}:
 *   core tracking behaviour (`autoTrack`, `domains`, consent, etc.)
 * - {@link ProviderOptions | provider options}:
 *   which analytics backend to use and how to configure it
 * - {@link DispatcherOptions | dispatcher options}:
 *   transport, batching, and resilience settings
 *
 * All facade options are optional and will use sensible defaults.
 *
 * @example
 * ```ts
 * const analytics = createAnalytics({
 *   provider: {
 *     name: 'ga4',
 *     measurementId: 'G-XXXXXXXXXX',
 *   },
 *   autoTrack: true,
 *   trackLocalhost: false,
 *   dispatcher: {
 *     batching: { enabled: true, maxSize: 10 },
 *   },
 * });
 * ```
 */
export interface AnalyticsOptions extends Partial<FacadeOptions> {
  /**
   * Analytics provider configuration (GA4, Plausible, Umami, or noop).
   *
   * See {@link ProviderOptions} and provider-specific docs for details.
   */
  provider?: ProviderOptions;

  /**
   * Advanced transport, batching, and resilience configuration.
   *
   * See {@link DispatcherOptions}.
   */
  dispatcher?: DispatcherOptions;
}

/**
 * Internal resolved configuration after applying defaults and validation.
 *
 * This is the normalised shape used internally by the analytics facade
 * after processing user-provided {@link AnalyticsOptions}.
 *
 * @internal
 */
export interface ResolvedAnalyticsOptions {
  /**
   * Fully resolved facade options with all defaults applied.
   */
  facade: ResolvedFacadeOptions;

  /**
   * Validated and normalised provider configuration.
   */
  provider: ResolvedProviderOptions;

  /**
   * Resolved dispatcher configuration.
   */
  dispatcher: ResolvedDispatcherOptions;
}

/**
 * Public analytics instance exposed by Trackkit.
 *
 * This is what callers interact with when using the facade API.
 */
export interface AnalyticsInstance {
  /** Name of the active provider (e.g. `'ga4'`, `'plausible'`). */
  name: string;

  /**
   * Track a custom event.
   *
   * @param name - Event name (e.g. `"button_click"`).
   * @param props - Optional event properties (JSON-serialisable).
   * @param category - Optional consent category; defaults to `'analytics'`
   *   in most setups. See {@link ConsentCategory}.
   */
  track(name: string, props?: Props, category?: ConsentCategory): void;

  /**
   * Track a page view using the current page context.
   */
  pageview(): void;

  /**
   * Identify the current user.
   *
   * @param userId - User identifier or `null` to clear.
   */
  identify(userId: string | null): void;

  /**
   * Clean up and destroy the instance.
   *
   * After calling this, the instance should not be used again.
   */
  destroy(): void;
}

/**
 * Low-level provider instance contract.
 *
 * Implemented by provider adapters / clients (GA4, Plausible, Umami, etc.)
 * and consumed by the facade. Most applications never interact with this
 * directly.
 *
 * @internal
 */
export interface ProviderInstance {
  /** Provider identifier, e.g. `'ga4'` or `'plausible'`. */
  name: string;

  /**
   * Track a custom event.
   *
   * @param name - Event name (e.g. `"button_click"`).
   * @param props - Event properties (may be empty).
   * @param pageContext - Page context for the event.
   */
  track(name: string, props: Props, pageContext: PageContext): Promise<void>;

  /**
   * Track a page view.
   *
   * @param pageContext - Page context for the page view.
   */
  pageview(pageContext: PageContext): Promise<void>;

  /**
   * Identify the current user.
   *
   * @param userId - User identifier or `null` to clear.
   * @param pageContext - Page context for the identification event.
   */
  identify(userId: string | null, pageContext: PageContext): void;

  /**
   * Clean up and destroy the provider.
   */
  destroy(): void;
}
