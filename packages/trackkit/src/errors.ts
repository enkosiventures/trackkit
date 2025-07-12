export type ErrorCode = 
  | 'INIT_FAILED'
  | 'PROVIDER_ERROR'
  | 'NETWORK_ERROR'
  | 'QUEUE_OVERFLOW'
  | 'INVALID_CONFIG'
  | 'CONSENT_REQUIRED';

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

/**
 * Safe error logger that handles circular references
 */
export function stringifyError(error: unknown): string {
  if (error instanceof Error) {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }
  
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}