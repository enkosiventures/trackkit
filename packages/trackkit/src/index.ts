import { loadProvider } from './provider-loader';
import { readEnvConfig, parseEnvBoolean, parseEnvNumber } from './util/env';
import { AnalyticsError, isAnalyticsError } from './errors';
import { createLogger, setGlobalLogger, logger } from './util/logger';
import type {
  AnalyticsInstance,
  AnalyticsOptions,
  ConsentState,
  Props,
  ProviderType,
} from './types';

/**
 * Global singleton instance
 * @internal
 */
let instance: AnalyticsInstance | null = null;

/** 
 * Global error handler 
 * @internal
 */
let errorHandler: ((error: AnalyticsError) => void) | undefined;

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
 * Merges environment variables with provided options
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
  try {
    // Return existing instance if already initialized
    if (instance) {
      if (options.debug) {
        console.warn('[trackkit] Analytics already initialized, returning existing instance');
      }
      return instance;
    }
    
    // Merge environment config with options (options take precedence)
    const envConfig = readEnvConfig();
    const config: AnalyticsOptions = {
      provider: (options.provider ?? envConfig.provider ?? 'noop') as ProviderType,
      siteId: options.siteId ?? envConfig.siteId,
      host: options.host ?? envConfig.host,
      queueSize: options.queueSize ?? parseEnvNumber(envConfig.queueSize, 50),
      debug: options.debug ?? parseEnvBoolean(envConfig.debug, false),
      onError: options.onError,
      ...options, // Ensure any additional options override
    };

    // Configure debug logging
    const debugLogger = createLogger(config.debug || false);
    setGlobalLogger(debugLogger);
    
    // Store error handler
    errorHandler = config.onError;
    
    // Log initialization
    logger.info('Initializing analytics', {
      provider: config.provider,
      debug: config.debug,
      queueSize: config.queueSize,
    });
    
    // Validate configuration
    validateConfig(config);
    
    // Load provider
    const provider = loadProvider(config.provider as any);
    instance = provider.create(config);
    
    logger.info('Analytics initialized successfully');
    return instance;

  } catch (error) {
    const analyticsError = isAnalyticsError(error) 
      ? error 
      : new AnalyticsError(
          'Failed to initialize analytics',
          'INIT_FAILED',
          options.provider,
          error
        );
    
    handleError(analyticsError);
    
    // Return no-op instance to prevent app crashes
    const noop = loadProvider('noop');
    instance = noop.create(options);
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
 * Validate configuration options
 */
function validateConfig(config: AnalyticsOptions): void {
  if (config.queueSize && config.queueSize < 1) {
    throw new AnalyticsError(
      'Queue size must be at least 1',
      'INVALID_CONFIG'
    );
  }
  
  if (config.batchSize && config.batchSize < 1) {
    throw new AnalyticsError(
      'Batch size must be at least 1',
      'INVALID_CONFIG'
    );
  }
  
  // Provider-specific validation will be added in Stage 4
}

/**
 * Global error handler
 * Handles errors from analytics operations
 * @param error - The error to handle
 * @internal
 */
function handleError(error: AnalyticsError): void {
  logger.error('Analytics error:', error);
  
  if (errorHandler) {
    try {
      errorHandler(error);
    } catch (callbackError) {
      logger.error('Error in error handler callback:', callbackError);
    }
  }
}

/**
 * Wrap method calls with error handling
 * 
 * @param fn - Function to call
 * @param methodName - Name of the method for logging
 * @returns Wrapped function that handles errors gracefully
 */
function safeCall<T extends unknown[], R>(
  fn: (...args: T) => R,
  methodName: string
): (...args: T) => R | undefined {
  return (...args: T) => {
    try {
      if (!instance) {
        logger.warn(`${methodName} called before initialization`);
        return undefined;
      }
      return fn.apply(instance, args);
    } catch (error) {
      handleError(
        new AnalyticsError(
          `Error in ${methodName}`,
          'PROVIDER_ERROR',
          undefined,
          error
        )
      );
      return undefined;
    }
  };
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
export const track = safeCall(
  (...args: Parameters<AnalyticsInstance['track']>) => instance!.track(...args),
  'track'
);

/**
 * Track a page view
 * 
 * @param url - Optional URL override
 */
export const pageview = safeCall(
  (...args: Parameters<AnalyticsInstance['pageview']>) => instance!.pageview(...args),
  'pageview'
);

/**
 * Identify the current user
 * 
 * @param userId - User identifier or null to clear
 */
export const identify = safeCall(
  (...args: Parameters<AnalyticsInstance['identify']>) => instance!.identify(...args),
  'identify'
);

/**
 * Update user consent state
 * 
 * @param state - 'granted' or 'denied'
 */
export const setConsent = safeCall(
  (...args: Parameters<AnalyticsInstance['setConsent']>) => instance!.setConsent(...args),
  'setConsent'
);

/**
 * Destroy the analytics instance and clean up
 */
export const destroy = () => {
  try {
    logger.info('Destroying analytics instance');
    instance?.destroy();
    instance = null;
    errorHandler = undefined;
    setGlobalLogger(createLogger(false));
  } catch (error) {
    handleError(
      new AnalyticsError(
        'Error destroying analytics',
        'PROVIDER_ERROR',
        undefined,
        error
      )
    );
  }
};

// Re-export types for consumer convenience
export type { 
  AnalyticsInstance, 
  AnalyticsOptions, 
  ConsentState, 
  Props,
  ProviderType 
} from './types';
export {
  AnalyticsError,
  isAnalyticsError,
  type ErrorCode
} from './errors';