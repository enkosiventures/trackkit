import type { ConsentCategory } from '../consent/types';
import type { ProviderInstance, ProviderOptions, ProviderType } from '../types';

/**
 * Provider lifecycle states
 */
export type ProviderState = 'idle' | 'initializing' | 'ready' | 'destroyed' | 'unknown';

/**
 * Provider adapter factory interface
 */
export interface ProviderFactory {
  /**
   * Create a new analytics instance
   */
  create(options: ProviderOptions, cache?: boolean, debug?: boolean): ProviderInstance;

  /**
   * Provider metadata
   */
  readonly meta?: {
    name: ProviderType;
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
  categories?: Array<ConsentCategory>;
  
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
