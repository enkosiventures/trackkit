export type ConnectionState = 'online' | 'offline' | 'slow';
export type ConnectionListener = (state: ConnectionState, quality?: any) => void;

export class ConnectionMonitor {
  private state: ConnectionState = 'online';
  private listeners = new Set<ConnectionListener>();
  private lastSuccess = Date.now();
  private intervalId: number | null = null;

  constructor(private cfg: { slowThreshold?: number; checkInterval?: number } = {}) {
    this.cfg = { slowThreshold: 3000, checkInterval: 30000, ...this.cfg };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline);
      window.addEventListener('offline', this.handleOffline);
      this.intervalId = window.setInterval(
        () => this.checkSlow(),
        this.cfg.checkInterval
      );
      this.state = navigator.onLine ? 'online' : 'offline';
    }
  }
  getState() { return this.state; }
  isHealthy() { return this.state === 'online'; }

  reportSuccess() {
    this.lastSuccess = Date.now();
    if (this.state !== 'online') this.update('online');
  }

  reportFailure(err?: Error) {
    // Treat explicit offline signals first
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      this.update('offline');
      return;
    }

    // "Failed to fetch" is a common message, but treat it as a hint, not a rule
    if (err?.message?.includes('Failed to fetch')) {
      this.update('offline');
      return;
    }

    const elapsed = Date.now() - this.lastSuccess;
    if (elapsed > this.cfg.slowThreshold!) {
      this.update('slow');
    }
  }

  subscribe(fn: ConnectionListener) { this.listeners.add(fn); fn(this.state); return () => this.listeners.delete(fn); }
  
  destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
      if (this.intervalId !== null) {
        window.clearInterval(this.intervalId);
        this.intervalId = null;
      }
    }
    this.listeners.clear();
  }

  private handleOnline = () => this.update('online');
  private handleOffline = () => this.update('offline');

  private checkSlow() {
    const now = Date.now();
    const elapsed = now - this.lastSuccess;
    if (this.state === 'online' && elapsed > this.cfg.slowThreshold! * 2) {
      this.update('slow');
    }
  }

  private update(to: ConnectionState) {
    if (this.state === to) return;
    this.state = to;
    this.listeners.forEach(l => { try { l(this.state); } catch {} });
  }
}