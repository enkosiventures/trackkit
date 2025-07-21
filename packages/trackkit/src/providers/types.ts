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
}