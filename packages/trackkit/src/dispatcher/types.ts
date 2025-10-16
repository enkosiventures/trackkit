export interface RetryOptions {
  maxAttempts?: number;
  initialDelay?: number;
  maxDelay?: number;
  multiplier?: number;
  jitter?: boolean;
  retryableStatuses?: number[];
}

export interface BatchingOptions {
  enabled: boolean;
  maxSize?: number;
  maxWait?: number;
  maxBytes?: number;
  concurrency?: number;
  deduplication?: boolean;
  retry?: RetryOptions;
};

export interface ConnectionOptions {
  monitor?: boolean;
  offlineStorage?: boolean;
  syncInterval?: number;
  slowThreshold?: number;
  checkInterval?: number;
};

export interface PerformanceOptions {
  enabled?: boolean;
  sampleRate?: number;
  logSummaryInterval?: number;
};

export interface ResilienceOptions {
  detectBlockers?: boolean;
  proxy?: { endpoint: string; token?: string; headers?: Record<string,string>; };
  fallbackStrategy?: 'proxy' | 'beacon' | 'none';
};
