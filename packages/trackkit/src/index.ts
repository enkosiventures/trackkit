import { loadProvider, preloadProvider } from './provider-loader';
import type { 
  AnalyticsInstance, 
  AnalyticsOptions, 
  ConsentState, 
  Props,
  ProviderType 
} from './types';
import { AnalyticsError } from './errors';
import { createLogger, logger, setGlobalLogger } from './util/logger';
import { StatefulProvider } from './providers/stateful-wrapper';
import { hydrateSSRQueue, isSSR, getSSRQueue } from './util/ssr-queue';
import type { QueuedEventUnion } from './util/queue';

/**
 * Global singleton instance
 * @internal
 */
let instance: StatefulProvider | null = null;

/**
 * Initialization promise for async loading
 * @internal
 */
let initPromise: Promise<StatefulProvider> | null = null;

/**
 * Pre-init queue for calls before init()
 * @internal
 */
const preInitQueue: QueuedEventUnion[] = [];

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
    logger.warn('Analytics already initialized, returning existing instance');
    return instance;
  }
  
  // If initialization is in progress, return a proxy
  if (initPromise) {
    return createInitProxy();
  }

  // Merge options with defaults
  const config: AnalyticsOptions = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  // Configure debug logging
  const debugLogger = createLogger(config.debug || false);
  setGlobalLogger(debugLogger);

  // Start async initialization
  initPromise = initializeAsync(config);
  
  // Return a proxy that queues calls until ready
  return createInitProxy();
}

/**
 * Async initialization logic
 */
async function initializeAsync(config: AnalyticsOptions): Promise<StatefulProvider> {
  try {
    logger.info('Initializing analytics', {
      provider: config.provider,
      debug: config.debug,
      queueSize: config.queueSize,
    });
    
    // Load and initialize provider
    instance = await loadProvider(config.provider as ProviderType, config);
    
    // Process SSR queue if in browser
    if (!isSSR()) {
      const ssrQueue = hydrateSSRQueue();
      if (ssrQueue.length > 0) {
        logger.info(`Processing ${ssrQueue.length} SSR events`);
        processEventQueue(ssrQueue);
      }
    }
    
    // Process pre-init queue
    if (preInitQueue.length > 0) {
      logger.info(`Processing ${preInitQueue.length} pre-init events`);
      processEventQueue(preInitQueue);
      preInitQueue.length = 0; // Clear queue
    }
    
    logger.info('Analytics initialized successfully');
    return instance;
    
  } catch (error) {
    const analyticsError = error instanceof AnalyticsError
      ? error
      : new AnalyticsError(
          'Failed to initialize analytics',
          'INIT_FAILED',
          config.provider,
          error
        );
    
    logger.error('Analytics initialization failed', analyticsError);
    config.onError?.(analyticsError);
    
    // Fall back to no-op
    try {
      instance = await loadProvider('noop', config);
      return instance;
    } catch (fallbackError) {
      // This should never happen, but just in case
      throw new AnalyticsError(
        'Failed to load fallback provider',
        'INIT_FAILED',
        'noop',
        fallbackError
      );
    }
  } finally {
    initPromise = null;
  }
}

/**
 * Create a proxy that queues method calls until initialization
 */
function createInitProxy(): AnalyticsInstance {
  const queueCall = (type: QueuedEventUnion['type'], args: unknown[]) => {
    if (isSSR()) {
      // In SSR, add to global queue
      const ssrQueue = getSSRQueue();
      ssrQueue.push({
        id: `ssr_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
    } else if (instance) {
      // If instance exists, delegate directly
      (instance as any)[type](...args);
    } else {
      // Otherwise queue for later
      preInitQueue.push({
        id: `pre_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
    }
  };
  
  return {
    track: (...args) => queueCall('track', args),
    pageview: (...args) => queueCall('pageview', args),
    identify: (...args) => queueCall('identify', args),
    setConsent: (...args) => queueCall('setConsent', args),
    destroy: () => {
      if (instance) {
        instance.destroy();
        instance = null;
      }
    },
  };
}

/**
 * Process a queue of events
 */
function processEventQueue(events: QueuedEventUnion[]): void {
  if (!instance) return;
  
  for (const event of events) {
    try {
      switch (event.type) {
        case 'track':
          instance.track(...event.args);
          break;
        case 'pageview':
          instance.pageview(...event.args);
          break;
        case 'identify':
          instance.identify(...event.args);
          break;
        case 'setConsent':
          instance.setConsent(...event.args);
          break;
      }
    } catch (error) {
      logger.error('Error processing queued event', { event, error });
    }
  }
}

/**
 * Get the current analytics instance
 * 
 * @returns Current instance or null if not initialized
 */
export function getInstance(): AnalyticsInstance | null {
  return instance;
}

/**
 * Wait for analytics to be ready
 * 
 * @param timeoutMs - Maximum time to wait in milliseconds
 * @returns Promise that resolves when ready
 */
export async function waitForReady(timeoutMs = 5000): Promise<AnalyticsInstance> {
  if (instance) {
    return instance;
  }
  
  if (!initPromise) {
    throw new Error('Analytics not initialized. Call init() first.');
  }
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Timeout waiting for analytics')), timeoutMs);
  });
  
  return Promise.race([initPromise, timeoutPromise]);
}

/**
 * Preload a provider for faster initialization
 * 
 * @param provider - Provider to preload
 */
export function preload(provider: ProviderType): Promise<void> {
  return preloadProvider(provider);
}

// Module-level convenience methods
export const track = (name: string, props?: Props, url?: string): void => {
  if (instance) {
    instance.track(name, props, url);
  } else {
    init().track(name, props, url);
  }
};

export const pageview = (url?: string): void => {
  if (instance) {
    instance.pageview(url);
  } else {
    init().pageview(url);
  }
};

export const identify = (userId: string | null): void => {
  if (instance) {
    instance.identify(userId);
  } else {
    init().identify(userId);
  }
};

export const setConsent = (state: ConsentState): void => {
  if (instance) {
    instance.setConsent(state);
  } else {
    init().setConsent(state);
  }
};

export const destroy = (): void => {
  if (instance) {
    instance.destroy();
    instance = null;
  }
  initPromise = null;
  preInitQueue.length = 0;
};

// Re-export types
export type { 
  AnalyticsInstance, 
  AnalyticsOptions, 
  ConsentState, 
  Props,
  ProviderType 
} from './types';
export { AnalyticsError, isAnalyticsError, type ErrorCode } from './errors';

// Export queue utilities for advanced usage
export { hydrateSSRQueue, serializeSSRQueue } from './util/ssr-queue';