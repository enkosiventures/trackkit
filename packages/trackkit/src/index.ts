import { loadProviderSync } from './provider-loader';
import type { 
  AnalyticsInstance, 
  AnalyticsOptions, 
  ConsentState, 
  Props,
  ProviderType 
} from './types';

/**
 * Global singleton instance
 * @internal
 */
let instance: AnalyticsInstance | null = null;

/**
 * Default options
 * @internal
 */
const DEFAULT_OPTIONS: Partial<AnalyticsOptions> = {
  provider: 'noop',
  queueSize: 50,
  debug: false,
  batchSize: 10,
  batchTimeout: 1000,
};

/**
 * Initialize analytics with the specified options
 * 
 * @param options - Configuration options
 * @returns Analytics instance (singleton)
 * 
 * @example
 * ```typescript
 * const analytics = init({
 *   provider: 'umami',
 *   siteId: 'my-site-id',
 *   debug: true
 * });
 * ```
 */
export function init(options: AnalyticsOptions = {}): AnalyticsInstance {
  // Return existing instance if already initialized
  if (instance) {
    if (options.debug) {
      console.warn('[trackkit] Analytics already initialized, returning existing instance');
    }
    return instance;
  }
  
  // Merge options with defaults
  const config: AnalyticsOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };
  
  try {
    // For Stage 1, use synchronous loading
    const factory = loadProviderSync(config.provider as ProviderType);
    instance = factory.create(config);
    
    if (config.debug) {
      console.info('[trackkit] Analytics initialized', {
        provider: config.provider,
        ...(config.siteId && { siteId: config.siteId }),
      });
    }
    
    return instance;
  } catch (error) {
    console.error('[trackkit] Failed to initialize analytics:', error);
    
    // Fallback to no-op to prevent app crashes
    const noopFactory = loadProviderSync('noop');
    instance = noopFactory.create(config);
    return instance;
  }
}

/**
 * Get the current analytics instance
 * 
 * @returns Current instance or null if not initialized
 * 
 * @example
 * ```typescript
 * const analytics = getInstance();
 * if (analytics) {
 *   analytics.track('event');
 * }
 * ```
 */
export function getInstance(): AnalyticsInstance | null {
  return instance;
}

/**
 * Track a custom event
 * 
 * @param name - Event name
 * @param props - Event properties
 * @param url - Optional URL override
 * 
 * @remarks
 * Calls to track() before init() will be silently ignored
 */
export function track(name: string, props?: Props, url?: string): void {
  instance?.track(name, props, url);
}

/**
 * Track a page view
 * 
 * @param url - Optional URL override
 */
export function pageview(url?: string): void {
  instance?.pageview(url);
}

/**
 * Identify the current user
 * 
 * @param userId - User identifier or null to clear
 */
export function identify(userId: string | null): void {
  instance?.identify(userId);
}

/**
 * Update user consent state
 * 
 * @param state - 'granted' or 'denied'
 */
export function setConsent(state: ConsentState): void {
  instance?.setConsent(state);
}

/**
 * Destroy the analytics instance and clean up
 */
export function destroy(): void {
  if (instance) {
    instance.destroy();
    instance = null;
  }
}

// Re-export types for consumer convenience
export type { 
  AnalyticsInstance, 
  AnalyticsOptions, 
  ConsentState, 
  Props,
  ProviderType 
} from './types';