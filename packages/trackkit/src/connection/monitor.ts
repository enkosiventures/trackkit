export type ConnectionState = 'online' | 'offline' | 'slow';
export type ConnectionListener = (state: ConnectionState, quality?: any) => void;

export class ConnectionMonitor {
  private state: ConnectionState = 'online';
  private listeners = new Set<ConnectionListener>();
  private lastSuccess = Date.now();
  constructor(private cfg: { slowThreshold?: number; checkInterval?: number } = {}) {
    this.cfg = { slowThreshold: 3000, checkInterval: 30000, ...this.cfg };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      setInterval(() => this.checkSlow(), this.cfg.checkInterval);
      this.state = navigator.onLine ? 'online' : 'offline';
    }
  }
  getState() { return this.state; }
  isHealthy() { return this.state === 'online'; }
  reportSuccess() { this.lastSuccess = Date.now(); if (this.state !== 'online') this.update('online'); }
  reportFailure(err?: Error) {
    if (err?.message?.includes('Failed to fetch')) return this.update('offline');
    if (Date.now() - this.lastSuccess > this.cfg.slowThreshold!) this.update('slow');
  }
  subscribe(fn: ConnectionListener) { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.listeners.clear();
  }
  private handleOnline = () => this.update('online');
  private handleOffline = () => this.update('offline');
  private checkSlow() {
    if (this.state === 'online' && Date.now() - this.lastSuccess > (this.cfg.slowThreshold! * 2)) this.update('slow');
  }
  private update(to: ConnectionState) {
    if (this.state === to) return;
    this.state = to;
    this.listeners.forEach(l => { try { l(this.state); } catch {} });
  }
}