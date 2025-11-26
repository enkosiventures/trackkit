import type { RetryOptions } from "./types";


export function calculateRetryDelay(attempt: number, config: Required<RetryOptions>) {
  const base = config.initialDelay * Math.pow(config.multiplier, attempt - 1);
  const delay = Math.min(base, config.maxDelay);
  if (config.jitter) {
    const j = delay * 0.25;
    return delay + (Math.random() - 0.5) * j * 2;
  }
  return delay;
}

export function isRetryableError(err: any, config: Required<RetryOptions>) {
  if (err?.code === 'NETWORK_ERROR' || err?.code === 'ECONNREFUSED') return true;
  if (typeof err?.status === 'number' && config.retryableStatuses?.includes(err.status)) return true;
  if (err?.code === 'ETIMEDOUT' || err?.message?.includes('timeout')) return true;
  return false;
}

export class RetryManager {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  constructor(private cfg: Required<RetryOptions>) {}

  scheduleRetry(key: string, fn: () => Promise<void>, attempt = 1) {
    if (attempt > this.cfg.maxAttempts) return;
    const delay = calculateRetryDelay(attempt, this.cfg);
    this.cancelRetry(key);
    const t = setTimeout(async () => {
      this.timers.delete(key);
      try {
        await fn();
      } catch (e) {
        if (isRetryableError(e, this.cfg)) this.scheduleRetry(key, fn, attempt + 1);
      }
    }, delay);
    this.timers.set(key, t);
  }
  cancelRetry(key: string) { const t = this.timers.get(key); if (t) clearTimeout(t); this.timers.delete(key); }
  cancelAll() { this.timers.forEach(clearTimeout); this.timers.clear(); }
}