import type { StatefulProvider } from '../providers/stateful-wrapper';
import { loadProvider } from '../providers/loader';
import type { FacadeOptions, ProviderOptions, EventType, PageContext } from '../types';

export class ProviderManager {
  private provider: StatefulProvider | null = null;
  private readyCbs: Array<() => void> = [];
  private injected: boolean = false;

  constructor(private pCfg: ProviderOptions | null, private fCfg: FacadeOptions | null) {}

  async load(): Promise<StatefulProvider> {
    if (this.injected && this.provider) return this.provider;
    const loaded = await loadProvider(this.pCfg, this.fCfg?.cache, this.fCfg?.debug, this.fCfg?.onError);
    this.provider = loaded;

    if (typeof loaded.onReady === 'function') {
      loaded.onReady(() => this.drainReady());
    } else if (loaded.getState() === 'ready') {
      this.drainReady();
    }
    return loaded;
  }

  /** @internal test-only: inject a provider instance and make it "ready" */
  inject(p: StatefulProvider) {
    this.provider = p;
    this.injected = true;
    if (typeof p.onReady === 'function') {
      p.onReady(() => this.drainReady());
    } else if (p.getState() === 'ready') {
      this.drainReady();
    } else {
      // If no onReady and no state, assume ready and drain (keeps tests simple)
      this.drainReady();
    }
  }

  onReady(cb: () => void) {
    this.readyCbs.push(cb);
    const state = this.provider?.getState();
    if (state === 'ready') cb();
  }

  name(): string | undefined { return this.provider?.name }

  get(): StatefulProvider | null { return this.provider; }

  call(type: EventType, args: unknown[], ctx: PageContext) {
    // @ts-expect-error dynamic dispatch
    return this.provider?.[type](...args, ctx);
  }

  destroy() {
    try { this.provider?.destroy?.(); } catch {}
    this.provider = null;
    this.readyCbs = [];
    this.injected = false;
  }

  private drainReady() {
    if (!this.readyCbs.length) return;
    const cbs = this.readyCbs.slice();
    this.readyCbs.length = 0;
    for (const cb of cbs) { try { cb(); } catch {} }
  }
}
