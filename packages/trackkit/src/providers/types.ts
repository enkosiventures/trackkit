import type { AnalyticsInstance, AnalyticsOptions } from '../types';

/**
 * Internal provider lifecycle state
 */
export type ProviderState = 'idle' | 'initializing' | 'ready' | 'destroyed';

/**
 * Provider adapter factory interface
 */
export interface ProviderFactory {
  /**
   * Create a new analytics instance
   */
  create(options: AnalyticsOptions): AnalyticsInstance;
  
  /**
   * Provider metadata
   */
  readonly meta?: {
    name: string;
    version?: string;
  };
}

/**
 * Provider loading strategies
 */
export type SyncLoader = () => ProviderFactory;
export type AsyncLoader = () => Promise<ProviderFactory>;
export type ProviderLoader = SyncLoader | AsyncLoader;

/**
 * Extended analytics instance with provider internals
 */
export interface ProviderInstance extends AnalyticsInstance {
  name: string;
  
  /**
   * Provider-specific initialization (optional)
   */
  _init?(): Promise<void>;

  /**
   * Set callback for navigation events (optional)
   * Used by providers that detect client-side navigation
   */
  _setNavigationCallback?(callback: (url: string) => void): void;
}

/**
 * Consent configuration for providers
 * Used to determine if provider can operate based on user consent
 */
export interface ProviderConsentConfig {
  /**
   * Whether this provider requires explicit consent
   * Can be overridden by user configuration
   */
  requireExplicit?: boolean;

  /**
   * Whether this provider can be used for essential/necessary tracking
   * (e.g., security, critical functionality)
   */
  supportsEssential?: boolean;
  
  /**
   * Default consent mode for this provider
   */
  defaultMode?: 'opt-in' | 'opt-out' | 'essential-only';
  
  /**
   * Categories this provider uses
   */
  categories?: Array<'essential' | 'analytics' | 'marketing' | 'preferences'>;
  
  /**
   * Provider-specific consent hints
   */
  hints?: {
    /**
     * Whether provider uses cookies
     */
    usesCookies?: boolean;
    
    /**
     * Whether provider stores personally identifiable information
     */
    storesPII?: boolean;
    
    /**
     * Data retention period in days
     */
    dataRetentionDays?: number;
  };
}
