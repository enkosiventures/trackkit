import { describe, it, expect } from 'vitest';
import { calculateRetryDelay, isRetryableError } from '../../../src/dispatcher/retry';

describe('retry utils', () => {
  it('computes exponential backoff without jitter deterministically', () => {
    const cfg = { maxAttempts: 5, initialDelay: 100, multiplier: 2, maxDelay: 1000, jitter: false, retryableStatuses: [503] };
    expect(calculateRetryDelay(1, cfg as any)).toBe(100);
    expect(calculateRetryDelay(2, cfg as any)).toBe(200);
    expect(calculateRetryDelay(3, cfg as any)).toBe(400);
    expect(calculateRetryDelay(4, cfg as any)).toBe(800);
    expect(calculateRetryDelay(5, cfg as any)).toBe(1000); // capped
  });

  it('marks typical cases as retryable', () => {
    const cfg = { maxAttempts: 3, initialDelay: 100, multiplier: 2, maxDelay: 1000, jitter: true, retryableStatuses: [408, 429, 500, 502, 503, 504] };

    expect(isRetryableError({ status: 503 }, cfg as any)).toBe(true);
    expect(isRetryableError({ status: 400 }, cfg as any)).toBe(false);
    expect(isRetryableError({ code: 'NETWORK_ERROR' }, cfg as any)).toBe(true);
    expect(isRetryableError(new Error('timeout exceeded'), cfg as any)).toBe(true);
  });
});
