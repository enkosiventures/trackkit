const hasPerf = typeof performance !== 'undefined' && typeof performance.now === 'function';

export class PerformanceTracker {
  private eventTimings: number[] = [];
  private networkTimings: number[] = [];
  private initStart?: number;

  metrics = {
    initTime: 0,
    avgProcessingTime: 0,
    avgNetworkLatency: 0,
    totalEvents: 0,
    failedEvents: 0
  };

  markInitStart() {
    if (!hasPerf) return;
    this.initStart = performance.now();
  }

  markInitComplete() {
    if (!hasPerf || this.initStart == null) return;
    this.metrics.initTime = performance.now() - this.initStart;
  }

  trackEvent(fn: () => void) {
    const start = hasPerf ? performance.now() : 0;
    try {
      fn();
      this.metrics.totalEvents++;
    } catch (err) {
      this.metrics.failedEvents++;
      // preserve the original error, don't throw a generic one
      throw err;
    } finally {
      if (hasPerf) {
        const duration = performance.now() - start;
        this.eventTimings.push(duration);
        if (this.eventTimings.length > 100) this.eventTimings.shift();
        const sum = this.eventTimings.reduce((a, b) => a + b, 0);
        this.metrics.avgProcessingTime = sum / this.eventTimings.length;
      }
    }
  }

  async trackNetworkRequest<T>(_label: string, fn: () => Promise<T>) {
    const start = hasPerf ? performance.now() : 0;
    try {
      const res = await fn();
      if (hasPerf) {
        const duration = performance.now() - start;
        this.networkTimings.push(duration);
        if (this.networkTimings.length > 50) this.networkTimings.shift();
        const sum = this.networkTimings.reduce((a, b) => a + b, 0);
        this.metrics.avgNetworkLatency = sum / this.networkTimings.length;
      }
      return res;
    } catch (err) {
      if (hasPerf) {
        // still record the timing on failure
        const duration = performance.now() - start;
        this.networkTimings.push(duration);
        if (this.networkTimings.length > 50) this.networkTimings.shift();
        const sum = this.networkTimings.reduce((a, b) => a + b, 0);
        this.metrics.avgNetworkLatency = sum / this.networkTimings.length;
      }
      throw err;
    }
  }
}