export interface RetryOptions {
  maxAttempts?: number;         // default 3
  initialDelay?: number;        // default 1000
  maxDelay?: number;            // default 30000
  multiplier?: number;          // default 2
  jitter?: boolean;             // default true
  retryableStatuses?: number[]; // default [408,429,500,502,503,504]
}

export interface BatchingOptions {
  enabled: boolean;
  maxSize?: number;     // default 10
  maxWait?: number;     // default 1000
  maxBytes?: number;    // default 64*1024
  concurrency?: number; // default 2
  deduplication?: boolean; // default true
  retry?: RetryOptions;
};

export interface ConnectionOptions {
  monitor?: boolean;        // default false
  offlineStorage?: boolean; // default false
  syncInterval?: number;    // default 30000
  slowThreshold?: number;   // default 3000
  checkInterval?: number;   // default 30000
};

export interface PerformanceOptions {
  enabled?: boolean;        // default false
  sampleRate?: number;      // optional sampling
  logSummaryInterval?: number;
};

export interface ResilienceOptions {
  detectBlockers?: boolean; // default false
  proxy?: { endpoint: string; token?: string; headers?: Record<string,string>; };
  fallbackStrategy?: 'proxy' | 'beacon' | 'none'; // default 'proxy'
};
