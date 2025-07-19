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
import { parseEnvBoolean, parseEnvNumber, readEnvConfig } from './util/env';

/**
 * Global singleton instance
 * @internal
 */
let proxyInstance: StatefulProvider = createLazyQueueProvider();
let realInstance:  StatefulProvider | null = null

/**
 * Initialization promise for async loading
 * @internal
 */
let initPromise: Promise<void> | null = null;

/**
 * Pre-init queue for calls before init()
 * @internal
 */
const preInitQueue: QueuedEventUnion[] = [];

/**
 * Default options
 * @internal
 */
// const envConfig = readEnvConfig();
// const DEFAULT_OPTIONS: Partial<AnalyticsOptions> = {
//   provider: (envConfig.provider ?? 'noop') as ProviderType,
//   siteId: envConfig.siteId,
//   host: envConfig.host,
//   queueSize: parseEnvNumber(envConfig.queueSize, 50),
//   debug: parseEnvBoolean(envConfig.debug, false),
//   batchSize: 10,
//   batchTimeout: 1000,
// };

/**
 * Get the current analytics instance
 * 
 * @returns Current instance or null if not initialized
 */
export function getInstance(): StatefulProvider | null {
  return realInstance || proxyInstance;
}

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
  console.warn("[TRACKKIT] Initializing analytics with options:", options);

  // Return existing instance if already initialized
  if (realInstance) {
    console.warn("[TRACKKIT] Analytics already initialized, returning existing instance");
    logger.warn('Analytics already initialized, returning existing instance');
    return realInstance;
  }
  
  // If initialization is in progress, return a proxy
  if (initPromise) {
    console.warn("[TRACKKIT] Initialization in progress, returning proxy for queued calls");
    return proxyInstance;
  }

  // Set default options if not provided
  console.warn("[TRACKKIT] Reading environment config for defaults");
  const envConfig = readEnvConfig();
  const default_options: Partial<AnalyticsOptions> = {
    provider: (envConfig.provider ?? 'noop') as ProviderType,
    siteId: envConfig.siteId,
    host: envConfig.host,
    queueSize: parseEnvNumber(envConfig.queueSize, 50),
    debug: parseEnvBoolean(envConfig.debug, false),
    batchSize: 10,
    batchTimeout: 1000,
  };

  // Merge options with defaults
  const config: AnalyticsOptions = {
    ...default_options,
    ...options,
  };

  // Configure debug logging
  console.warn("[TRACKKIT] Configuring debug logger with:", config.debug);
  const debugLogger = createLogger(config.debug || false);
  setGlobalLogger(debugLogger);

  // Start async initialization
  console.warn("[TRACKKIT] - Starting async initialization");
  initPromise = initializeAsync(config);
  
  // Return a proxy that queues calls until ready
  console.warn("[TRACKKIT] - Returning init proxy for queued calls");
  return createInitProxy();
}

/**
 * Async initialization logic
 */
async function initializeAsync(config: AnalyticsOptions): Promise<void> {
  logger.warn('Async Initializing analytics', config);
  
  try {
    logger.info('AInitializing analytics', {
      provider: config.provider,
      debug: config.debug,
      queueSize: config.queueSize,
    });
    
    // Load and initialize provider
    console.warn("[TRACKKIT] - Provider loading:", realInstance);
    realInstance = await loadProvider(config.provider as ProviderType, config);
    console.warn("[TRACKKIT] - Provider loaded:", realInstance);

    // Process SSR queue if in browser
    if (!isSSR()) {
      const ssrQueue = hydrateSSRQueue();
      if (ssrQueue.length > 0) {
        logger.info(`Processing ${ssrQueue.length} SSR events`);
        processEventQueue(ssrQueue);
      }
    }
    
    // Process pre-init queue
    console.warn("Pre-init queue:", preInitQueue);
    console.warn("Pre-init queue length:", preInitQueue.length);
    if (preInitQueue.length > 0) {
      console.warn("Processing pre-init queue", preInitQueue);
      logger.info(`Processing ${preInitQueue.length} pre-init events`);
      processEventQueue(preInitQueue);
      preInitQueue.length = 0; // Clear queue
    }
    
    logger.info('Analytics initialized successfully');
    
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
      realInstance = await loadProvider('noop', config);
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

function createLazyQueueProvider(): StatefulProvider {
  console.warn("[TRACKKIT] Creating lazy queue provider");
  const envConfig = readEnvConfig();
  return new StatefulProvider(createProxyFacade(), {
    provider: 'noop',
    siteId: '',
    host: '',
    queueSize: parseEnvNumber(envConfig.queueSize, 50),
    debug: parseEnvBoolean(envConfig.debug, false),
    batchSize: 10,
    batchTimeout: 1000,
  });
}

function createProxyFacade(): AnalyticsInstance {
  const queue: { m: keyof AnalyticsInstance; a: any[] }[] = [];

  function delegateOrQueue(type: keyof AnalyticsInstance, args: any[]) {
    // if (realInstance) {
    //   (realInstance[method] as any)(...args);
    // } else {
    //   queue.push({ m: method, a: args });
    // }

    console.warn("[TRACKKIT] Queueing call:", type, args);
    if (isSSR()) {
      // In SSR, add to global queue
      const ssrQueue = getSSRQueue();
      ssrQueue.push({
        id: `ssr_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
    } else if (realInstance) {
      // If instance exists, delegate directly
      (realInstance as any)[type](...args);
    } else {
      // Otherwise queue for later
      console.warn("Queueing pre-init event", args);
      preInitQueue.push({
        id: `pre_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
    }
  }

  function flushQueuedCalls() {
    for (const { m, a } of queue) {
      (realInstance![m] as any)(...a);
    }
    queue.length = 0;
  }

  return {
    name: 'proxy',
    track: (...a) => delegateOrQueue('track', a),
    pageview: (...a) => delegateOrQueue('pageview', a),
    identify: (...a) => delegateOrQueue('identify', a),
    setConsent: (...a) => delegateOrQueue('setConsent', a),
    destroy: () => {
      realInstance?.destroy();
      realInstance = null;
    },
    _flushQueuedCalls: flushQueuedCalls,
  } as AnalyticsInstance;
}

/**
 * Helper to flush proxy queue after real provider is ready
 */
function flushQueuedCalls() {
  (proxyInstance as any)._flushQueuedCalls?.();
}

// /**
//  * Create a proxy that queues method calls until initialization
//  */
function createInitProxy(): AnalyticsInstance {
  console.warn("[TRACKKIT] Beginning init proxy creation");
  const queueCall = (type: QueuedEventUnion['type'], args: unknown[]) => {
    console.warn("[TRACKKIT] Queueing call:", type, args);
    if (isSSR()) {
      // In SSR, add to global queue
      const ssrQueue = getSSRQueue();
      ssrQueue.push({
        id: `ssr_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
    } else if (providerInitialized &&instance) {
      // If instance exists, delegate directly
      (instance as any)[type](...args);
    } else {
      // Otherwise queue for later
      console.warn("Queueing pre-init event", args);
      preInitQueue.push({
        id: `pre_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
    }
  };
  
//   console.warn("[TRACKKIT] Init proxy created successfully");
//   return {
//     name: 'init-proxy',
//     track: (...args) => queueCall('track', args),
//     pageview: (...args) => queueCall('pageview', args),
//     identify: (...args) => queueCall('identify', args),
//     setConsent: (...args) => queueCall('setConsent', args),
//     destroy: () => {
//       if (instance) {
//         instance.destroy();
//         providerInitialized = false;
//         instance = createLazyQueueProvider();
//       }
//     },
//   };
// }

// /**
//  * Process a queue of events
//  */
// function processEventQueue(events: QueuedEventUnion[]): void {
//   if (!instance) return;
  
//   for (const event of events) {
//     console.warn("[TRACKKIT] Processing queued event", event);
//     try {
//       switch (event.type) {
//         case 'track':
//           console.warn("[TRACKKIT] Tracking event:", event.args, instance);
//           instance.track(...event.args);
//           break;
//         case 'pageview':
//           console.warn("[TRACKKIT] Pageview event:", event.args);
//           instance.pageview(...event.args);
//           break;
//         case 'identify':
//           console.warn("[TRACKKIT] Identify event:", event.args);
//           instance.identify(...event.args);
//           break;
//         case 'setConsent':
//           console.warn("[TRACKKIT] Set consent event:", event.args);
//           instance.setConsent(...event.args);
//           break;
//       }
//     } catch (error) {
//       console.error("[TRACKKIT] Error processing queued event", event, error);
//       logger.error('Error processing queued event', { event, error });
//     }
//   }
// }

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
export const track = (name: string, props?: Props, url?: string): void =>
  instance.track(name, props, url);

export const pageview = (url?: string): void =>
  instance.pageview(url);

export const identify = (userId: string | null): void =>
  instance.identify(userId);

export const setConsent = (state: ConsentState): void =>
  instance.setConsent(state);

export const destroy = (): void => {
  if (instance) {
    instance.destroy();
    providerInitialized = false;
    instance = createLazyQueueProvider();
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