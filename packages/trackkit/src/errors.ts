import type { ProviderType } from './types';
import { logger, stringifyError } from './util/logger';

export type ErrorCode = 
  | 'INIT_FAILED'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'QUEUE_OVERFLOW'
  | 'INVALID_CONFIG'
  | 'INVALID_ENVIRONMENT'
  | 'CONSENT_REQUIRED'
  | 'POLICY_BLOCKED'
  | 'READY_TIMEOUT'
  | 'TIMEOUT'
  | 'UNKNOWN';

export class AnalyticsError extends Error {
  public readonly timestamp: number;
  
  constructor(
    message: string,
    public readonly code: ErrorCode,
    public readonly provider?: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'AnalyticsError';
    this.timestamp = Date.now();
    
    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AnalyticsError);
    }
  }
  
  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      provider: this.provider,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

/**
 * Type guard for AnalyticsError
 */
export function isAnalyticsError(error: unknown): error is AnalyticsError {
  return error instanceof AnalyticsError;
}

// ------------------------------
// Default & user error handling
// ------------------------------
export type ErrorHandler = (err: AnalyticsError) => void;

let userHandler: ErrorHandler | null = null;
let defaultHandler: ErrorHandler;

// simple de-dupe to avoid spamming the console in production
const SEEN = new Set<string>();


defaultHandler = function defaultErrorHandler(err: AnalyticsError) {
  const key = `${err.code}:${err.message}`;
  if (SEEN.has(key)) return;
  SEEN.add(key);

  // Always log in dev; in prod we still log but the de-dupe keeps noise down
  logger.error('Unhandled analytics error', err.toJSON?.() ?? err);
};

export function setUserErrorHandler(fn?: ErrorHandler | null) {
  userHandler = fn ?? defaultHandler;
}

export function normalizeError(e: unknown, fallbackCode: ErrorCode = 'UNKNOWN', provider?: ProviderType): AnalyticsError {
  if (e instanceof AnalyticsError) return e;
  if (e instanceof Error) {
    return new AnalyticsError(e.message, fallbackCode, provider, e);
  }
  return new AnalyticsError(String(e), fallbackCode, provider, e);
}

/**
 * Safely emit an error to the user handler _and_ default logger.
 * Never throws.
 */
export function dispatchError(e: unknown, code: ErrorCode = 'UNKNOWN', provider?: ProviderType) {
  const err = normalizeError(e, code, provider);

  // call user handler safely
  try {
    userHandler?.(err);
  } catch (handlerErr) {
    // User’s handler exploded – log both
    logger.error(
      'Error in error handler',
      stringifyError(err),
      stringifyError(handlerErr as Error)
    );
  }

  // Always call default handler as safety net if the user didn’t provide one
  if (!userHandler) {
    defaultHandler(err);
  }
}