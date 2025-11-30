// import type { ConsentCategory } from '../consent/types';
// import type { ProviderInstance, ProviderOptions, ProviderType } from '../types';
// import type { Sender } from './base/transport';

// /**
//  * Base options common to all providers
//  */
// export type BaseProviderOptions = {
//   /**
//    * Analytics provider type
//    * @default 'noop'
//    * @example 'umami', 'plausible', 'ga4'
//    */
//   name: ProviderType;

//   /**
//    * Generic alias for provider-specific site/property ID
//    * @example 'G-XXXXXXXXXX' for Google Analytics
//    */
//   site?: string;

//   /**
//    * Custom analytics host URL
//    * @example 'https://analytics.example.com'
//    */
//   host?: string;
// };

// /**
//  * General options for provider factories
//  */
// export type FactoryOptions = {
//   bustCache: boolean;
//   debug: boolean;
//   sender: Sender;
// };

// /**
//  * Provider lifecycle states
//  */
// export type ProviderState = 'idle' | 'initializing' | 'ready' | 'destroyed' | 'unknown';

// /**
//  * Provider adapter factory interface
//  */
// export type ProviderFactory = {
//   /**
//    * Create a new analytics instance
//    */
//   create(options: { provider: ProviderOptions; factory: FactoryOptions }): ProviderInstance;

//   /**
//    * Provider metadata
//    */
//   readonly meta?: {
//     name: ProviderType;
//     version?: string;
//   };
// }

// /**
//  * Provider loading strategies
//  */
// export type SyncLoader = () => ProviderFactory;
// export type AsyncLoader = () => Promise<ProviderFactory>;
// export type ProviderLoader = SyncLoader | AsyncLoader;

// /**
//  * Consent configuration for providers
//  * Used to determine if provider can operate based on user consent
//  */
// export type ProviderConsentConfig = {
//   /**
//    * Whether this provider requires explicit consent
//    * Can be overridden by user configuration
//    */
//   requireExplicit?: boolean;

//   /**
//    * Whether this provider can be used for essential/necessary tracking
//    * (e.g., security, critical functionality)
//    */
//   supportsEssential?: boolean;
  
//   /**
//    * Default consent mode for this provider
//    */
//   defaultMode?: 'opt-in' | 'opt-out' | 'essential-only';
  
//   /**
//    * Categories this provider uses
//    */
//   categories?: Array<ConsentCategory>;
  
//   /**
//    * Provider-specific consent hints
//    */
//   hints?: {
//     /**
//      * Whether provider uses cookies
//      */
//     usesCookies?: boolean;
    
//     /**
//      * Whether provider stores personally identifiable information
//      */
//     storesPII?: boolean;
    
//     /**
//      * Data retention period in days
//      */
//     dataRetentionDays?: number;
//   };
// }




import type { ConsentCategory } from '../consent/types';
import type {
  ProviderInstance,
  ProviderOptions,
  ProviderType,
} from '../types';
import type { Sender } from './base/transport';

/**
 * Base options common to all providers.
 *
 * Provider-specific option types (GA4, Plausible, Umami, etc.) extend this
 * shape to add their own required/optional fields.
 */
export type BaseProviderOptions = {
  /**
   * Analytics provider type.
   *
   * @default 'noop'
   * @example 'umami', 'plausible', 'ga4'
   */
  name: ProviderType;

  /**
   * Generic alias for provider-specific site/property ID.
   *
   * Useful as a shared config surface:
   * - GA4: `G-XXXXXXXXXX`
   * - Plausible: domain (e.g. `example.com`)
   * - Umami: website ID (UUID)
   */
  site?: string;

  /**
   * Custom analytics host URL.
   *
   * For self-hosted deployments or regional endpoints.
   *
   * @example 'https://analytics.example.com'
   */
  host?: string;
};

/**
 * General options passed into provider factories.
 *
 * These are provider-agnostic transport and behaviour flags supplied by
 * the facade/loader layer.
 */
export type FactoryOptions = {
  /**
   * Enable cache-busting on provider HTTP requests.
   */
  bustCache: boolean;

  /**
   * Enable provider-level debug logging.
   */
  debug: boolean;

  /**
   * Low-level sender function used by the provider.
   *
   * For non-GA4 providers this is typically the dispatcher-backed sender.
   */
  sender: Sender;
};

/**
 * Provider lifecycle states.
 *
 * Used by {@link StatefulProvider} to represent readiness.
 */
export type ProviderState =
  | 'idle'
  | 'initializing'
  | 'ready'
  | 'destroyed'
  | 'unknown';

/**
 * Provider adapter factory contract.
 *
 * Provider implementations expose a factory that can:
 * - create a {@link ProviderInstance} from {@link ProviderOptions},
 * - expose metadata describing the provider.
 */
export type ProviderFactory = {
  /**
   * Create a new provider instance.
   *
   * @param options.provider - Provider-specific options (GA4, Plausible, etc.).
   * @param options.factory  - Provider-agnostic transport options.
   */
  create(options: {
    provider: ProviderOptions;
    factory: FactoryOptions;
  }): ProviderInstance;

  /**
   * Provider metadata.
   *
   * - `name`    – provider identifier.
   * - `version` – provider integration version (not the upstream SaaS version).
   */
  readonly meta?: {
    name: ProviderType;
    version?: string;
  };
};

/**
 * Loader for provider factories.
 *
 * Providers can be registered either synchronously or lazily via dynamic
 * imports to keep bundle size down.
 */
export type SyncLoader = () => ProviderFactory;

/**
 * Async loader returning a provider factory via a Promise.
 */
export type AsyncLoader = () => Promise<ProviderFactory>;

/**
 * Union of sync and async loader strategies.
 */
export type ProviderLoader = SyncLoader | AsyncLoader;

/**
 * Consent configuration for providers.
 *
 * Used by the consent gate to determine:
 * - whether a provider requires explicit consent,
 * - which categories it participates in,
 * - and various privacy-related hints.
 */
export type ProviderConsentConfig = {
  /**
   * Whether this provider requires explicit consent.
   *
   * Can be overridden by user configuration.
   */
  requireExplicit?: boolean;

  /**
   * Whether this provider can be used for essential/necessary tracking
   * (e.g. security, critical functionality).
   */
  supportsEssential?: boolean;

  /**
   * Default consent mode for this provider.
   *
   * - `'opt-in'`        – disabled until explicitly granted.
   * - `'opt-out'`       – enabled by default, user can opt out.
   * - `'essential-only'` – only essential events are allowed.
   */
  defaultMode?: 'opt-in' | 'opt-out' | 'essential-only';

  /**
   * Consent categories this provider participates in.
   *
   * Used by the consent manager to decide when provider sends are allowed.
   */
  categories?: Array<ConsentCategory>;

  /**
   * Provider-specific consent hints used for documentation and policy
   * templates.
   */
  hints?: {
    /**
     * Whether the provider uses cookies.
     */
    usesCookies?: boolean;

    /**
     * Whether the provider stores personally identifiable information.
     */
    storesPII?: boolean;

    /**
     * Data retention period in days, if known.
     */
    dataRetentionDays?: number;
  };
};
