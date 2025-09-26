export class PerformanceTracker {
  private eventTimings: number[] = [];
  private networkTimings: number[] = [];
  private initStart?: number;
  metrics = {
    initTime: 0, avgProcessingTime: 0, avgNetworkLatency: 0,
    totalEvents: 0, failedEvents: 0,
    networkTimings: { dns: 0, tcp: 0, tls: 0, request: 0, response: 0, total: 0 }
  };
  markInitStart() { this.initStart = performance.now(); }
  markInitComplete() { if (this.initStart) this.metrics.initTime = performance.now() - this.initStart; }
  trackEvent(fn: () => void) {
    const s = performance.now();
    try { fn(); this.metrics.totalEvents++; }
    catch { this.metrics.failedEvents++; throw new Error('processing'); }
    finally {
      const d = performance.now() - s;
      this.eventTimings.push(d); if (this.eventTimings.length > 100) this.eventTimings.shift();
      const sum = this.eventTimings.reduce((a,b)=>a+b,0);
      this.metrics.avgProcessingTime = sum / this.eventTimings.length;
    }
  }
  async trackNetworkRequest<T>(_label: string, fn: () => Promise<T>) {
    const s = performance.now();
    const res = await fn();
    const d = performance.now() - s;
    this.networkTimings.push(d); if (this.networkTimings.length > 50) this.networkTimings.shift();
    const sum = this.networkTimings.reduce((a,b)=>a+b,0);
    this.metrics.avgNetworkLatency = sum / this.networkTimings.length;
    return res;
  }
}