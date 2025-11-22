import type { StatefulProvider } from '../providers/stateful-wrapper';
import { loadProvider } from '../providers/loader';
import type { FacadeOptions, ProviderOptions, EventType, PageContext } from '../types';
import { PerformanceTracker } from '../performance/tracker';


export class ProviderManager {
  private provider: StatefulProvider | null = null;
  private injected: boolean = false;
  private readySubscribers = new Set<() => void>();

  constructor(private pCfg: ProviderOptions | null, private fCfg: FacadeOptions | null) {}

  async load(performanceTracker?: PerformanceTracker | null): Promise<StatefulProvider> {
    if (this.injected && this.provider) return this.provider;
    const loaded = await loadProvider({
        providerOptions: this.pCfg,
        batchingOptions: this.fCfg?.batching,
        resilienceOptions: this.fCfg?.resilience,
        bustCache: this.fCfg?.bustCache,
        debug: this.fCfg?.debug,
        performanceTracker,
        onError: this.fCfg?.onError,
    });
    this.provider = loaded;

    const current = this.provider;
    loaded.onReady(() => {
      if (this.provider === current) {
        this.emitReady();
      }
    });
    return loaded;
  }

  /** @internal test-only: inject a provider instance and make it "ready" */
  inject(p: StatefulProvider) {
    this.provider = p;
    this.injected = true;

    const current = this.provider;
    p.onReady(() => {
      if (this.provider === current) {
        this.emitReady();
      }
    });
  }

  /**
   * Register a callback to run once when the provider is ready.
   * If the provider is already ready, the callback is queued to run on the next microtask.
   * Returns a disposer to remove the callback before it fires.
   */
  onReady(fn: () => void): () => void {
    // If provider is ready, schedule async fire; disposer cancels if needed
    if (this.provider?.getState() === 'ready') {
      let disposed = false;
      queueMicrotask(() => { if (!disposed) try { fn(); } catch {} });
      return () => { disposed = true; };
    }
    this.readySubscribers.add(fn);
    return () => this.readySubscribers.delete(fn);
  }


  get(): StatefulProvider | null { return this.provider; }
  name(): string | undefined { return this.provider?.name }

  call(type: EventType, args: unknown[], ctx: PageContext) {
    // @ts-expect-error dynamic dispatch
    return this.provider?.[type](...args, ctx);
  }

  destroy() {
    try { this.provider?.destroy?.(); } catch {}
    this.provider = null;
    this.injected = false;
    this.readySubscribers.clear();
  }

  private emitReady() {
    if (this.readySubscribers.size === 0) return;
    const subscribers = Array.from(this.readySubscribers);
    this.readySubscribers.clear();
    for (const fn of subscribers) {
      try { fn(); } catch { /* swallow */ }
    }
  }
}
