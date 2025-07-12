import type { AnalyticsInstance, AnalyticsOptions, ProviderState } from '../types';

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
 * Extended analytics instance with provider internals
 */
export interface ProviderInstance extends AnalyticsInstance {
  /**
   * Provider-specific initialization (optional)
   */
  _init?(): Promise<void>;
  
  /**
   * Provider state
   */
  _state?: ProviderState;
}