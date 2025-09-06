import type { EventType, FacadeOptions, InitOptions, Props, ProviderOptions } from '../types';
import { mergeConfig, validateConfig, getConsentConfig } from './config'; // existing
import { ConsentManager } from '../consent/ConsentManager';               // existing
import { ConsentCategory, ConsentSnapshot, ConsentStatus } from '../consent/types';
import { PolicyGate } from './policy-gate';
import { ContextService } from './context';
import { QueueService } from './queues';
import { ProviderManager } from './provider-manager';
import { NavigationService } from './navigation';
import { Dispatcher } from '../dispatcher/dispatcher';
import { logger, createLogger, setGlobalLogger } from '../util/logger';   // existing
import { DEFAULT_CATEGORY, ESSENTIAL_CATEGORY } from '../constants';
import { isSSR } from '../util/ssr-queue';
import { AnalyticsError, setUserErrorHandler } from '../errors';
import { DiagnosticsService } from './diagnostics';
import { StatefulProvider } from '../providers/stateful-wrapper';
import { EventQueue, QueuedEventUnion } from '../util/queue';

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void; reject: (e: unknown) => void };
function deferred<T = void>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function withTimeout<T>(p: Promise<T>, ms?: number, onTimeout?: () => unknown): Promise<T> {
  if (!ms) return p;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(onTimeout ? onTimeout() : new AnalyticsError('Timed out', 'READY_TIMEOUT')), ms);
    p.then(v => { clearTimeout(t); resolve(v); }, e => { clearTimeout(t); reject(e); });
  });
}


export class AnalyticsFacade {
  readonly id = `AF_${Math.random().toString(36).slice(2,10)}`;

  private cfg: FacadeOptions | null = null;
  private pCfg: ProviderOptions | null = null;
  private consent: ConsentManager | null = null;

  private context!: ContextService;
  private queues!: QueueService;
  private policy!: PolicyGate;
  private provider!: ProviderManager;
  private nav!: NavigationService;
  private dispatcher!: Dispatcher;

  private diag!: DiagnosticsService;

  private initPromise: Promise<void> | null = null;

  private userId: string | null = null;

  private providerIsReady = false;
  private overflowNotified = false;
  private forceQueue = true; // start queued until provider attached/ready
  private providerReady = deferred<void>();
  private trackingReady = deferred<void>();
  private policyReasonsNotified = new Set<string>();

  private _preInjectedProvider: any | null = null;

  // Collect calls made before init() (when context/queues don’t exist yet)
  private preInitBuffer: EventQueue = new EventQueue({ maxSize: 50 });

  init(opts: InitOptions = {}): this {
    if (this.initPromise) return this;

    const resolved = mergeConfig(opts);
    this.cfg = resolved.facadeOptions;
    this.pCfg = resolved.providerOptions;

    setGlobalLogger(createLogger(!!this.cfg?.debug));
    setUserErrorHandler(this.cfg?.onError);
    validateConfig(resolved);

    this.context    = new ContextService(this.cfg!);
    this.queues     = new QueueService(this.cfg!, dropped => this.onOverflow(dropped.length));
    this.consent    = new ConsentManager(getConsentConfig(this.cfg!, this.pCfg?.provider));
    this.policy     = new PolicyGate(this.cfg!, this.consent, this.pCfg?.provider || 'noop');
    this.provider   = new ProviderManager(this.pCfg!, this.cfg!);
    this.nav        = new NavigationService();
    this.dispatcher = new Dispatcher();
    this.diag       = new DiagnosticsService(
      this.id, this.cfg!, this.consent as any, this.queues, this.context, this.provider, this.pCfg?.provider ?? null
    );

    // Readiness (one-shot) + gate
    // this.providerReady = deferred<void>();
    // this.trackingReady = deferred<void>();
    // this.forceQueue    = true;

    // Consent transitions — attach ONCE per init (not in initialize)
    this.consent?.onChange((to, from) => {
      logger.info('Consent changed', { from, to });
      if (to === 'granted') this.flushQueues();
      if (to === 'denied')  this.queues.clearFacade();
      this.maybeResolveReady(); // resolves tracking when provider already ready
    });

    // If a test stashed a provider, inject it BEFORE load starts
    if (this._preInjectedProvider) {
      // @ts-ignore internal
      this.provider.inject(this._preInjectedProvider);
      this._preInjectedProvider = null;
      this.forceQueue = false;
      this.providerIsReady = true;
      // this.maybeResolveReady();  // providerReady; trackingReady if consent resolved
    }

    this.drainPreInitBuffer();

    this.maybeResolveReady();

    // Kick off provider load
    this.initPromise = this.initialize().finally(() => (this.initPromise = null));
    return this;
  }

  private async initialize(): Promise<void> {
    try {
      await this.provider.load();
      this.attachProviderReadyHandlers();
      console.warn('Initialized provider:', this.provider?.get()?.name);
    } catch (e) {
      // Try to recover by falling back to noop
      try {
        await this.fallbackToNoop(e);
      } catch (fallbackErr) {
        // Hard failure: make waiters fail fast
        this.providerReady.reject(fallbackErr);
        this.trackingReady.reject(fallbackErr);
        this.cfg?.onError?.(
          new AnalyticsError(
            'Initialization failure',
            'INIT_FAILED',
            this.provider.name() ?? 'unknown',
            fallbackErr,
          )
        );
      }
    }
  }


  // === Public API (compat with README & legacy singleton) ===

  track(name: string, props?: Props, category = DEFAULT_CATEGORY) {
    this.execute({ type: 'track', args: [name, props], category });
  }

  pageview(url?: string) {
    this.execute({ type: 'pageview', url });
  }

  identify(userId: string | null) {
    this.userId = userId;
    this.execute({ type: 'identify', args: [userId], category: ESSENTIAL_CATEGORY });
  }

  // Consent passthroughs
  getConsent(): ConsentStatus | 'unknown' {
    return this.consent?.getStatus() ?? 'unknown';
  }
  getSnapshot(): ConsentSnapshot | null {
    return this.consent?.snapshot() || null;
  }
  grantConsent() { this.consent?.grant(); }
  denyConsent() { this.consent?.deny(); }
  resetConsent() { this.consent?.reset?.(); }

  // Ready utilities
  waitForReady(opts?: { timeoutMs?: number; mode?: 'tracking' | 'provider' }): Promise<void> {
    const mode = opts?.mode ?? 'tracking';
    const base = mode === 'provider' ? this.providerReady.promise : this.trackingReady.promise;
    return withTimeout(base, opts?.timeoutMs, () => new AnalyticsError('Timed out waiting for ready', 'READY_TIMEOUT'));
  }

  getQueueSize(): number { return this.queues?.size() ?? this.preInitBuffer.size; }

  hasQueuedEvents(): boolean { return this.getQueueSize() > 0; }

  flushIfReady(): boolean {
    if (this.isProviderReady() && this.consent?.getStatus() === 'granted') {
      this.flushQueues();
      return true;
    }
    return false;
  }

  getDiagnostics() { return this.diag.getSnapshot(); }

  destroy() {
    this.nav.stop();
    this.dispatcher.destroy();
    this.provider.destroy();
    this.queues.clearAll();
    this.context.reset();
    setUserErrorHandler(null);
    this.providerReady = deferred<void>();   // reset for next init
    this.trackingReady = deferred<void>();
    this.providerIsReady = false;
    this.forceQueue = true;
  }

  // === Internals ===

  private execute({ type, args = [], url, category = DEFAULT_CATEGORY }: { type: EventType; args?: unknown[]; url?: string; category?: ConsentCategory; }) {
    console.warn("Executing:", type, args, url, category)
    // If init() hasn’t run yet, we don’t have context/queues. Buffer per instance.
    if (!this.context) {
      const bufferedCtx = url ? { url: url as string } : undefined;
      this.preInitBuffer.enqueue(type, args as any, category, bufferedCtx);
      return;
    }

    const resolvedUrl = this.context.normalizeUrl(url ?? this.context.resolveCurrentUrl());
    const ctx = this.context.buildPageContext(resolvedUrl, this.userId);

    if (this.forceQueue) {
      this.queues.enqueue(type, args as any, category, ctx);
      return;
    }

    // if (type === 'pageview') {
    //   if (this.context.isDuplicatePageview(resolvedUrl)) {
    //     logger.debug('duplicate pageview', { resolvedUrl });
    //     return;
    //   }
    //   this.context.markPlanned(resolvedUrl); // ensures immediate subsequent PVs are dropped
    // }

    if (isSSR()) { this.queues.enqueue(type, args as any, category, ctx); return; }
    if (type === 'pageview' && this.context.isDuplicatePageview(resolvedUrl)) { logger.debug('duplicate pageview', { resolvedUrl }); return; }

    const decision = this.policy.shouldSend(type, category, resolvedUrl);
    const providerReady = this.isProviderReady();

    // if (decision.ok && providerReady) {
    //   const run = () => this.provider.call(type, args, ctx);
    //   this.dispatcher.enqueue({ id: `d_${Date.now()}_${Math.random()}`, type, run }).then(() => {
    //     if (type === 'pageview') this.context.markSent(resolvedUrl);
    //   }).catch(err => this.signalProviderError(type, err));
    //   return;
    // }
    if (decision.ok && providerReady) {
      if (type === 'pageview') {
        if (this.context.isDuplicatePageview(resolvedUrl)) {
          logger.debug('duplicate pageview', { resolvedUrl });
          return;
        }
        this.context.markPlanned(resolvedUrl);
      }

      const run = () => this.provider.call(type, args, ctx);
      this.dispatcher.enqueue({ id: `d_${Date.now()}_${Math.random()}`, type, run })
        .then(() => {
          if (type === 'pageview') this.context.markSent(resolvedUrl);
        })
        .catch(err => this.signalProviderError(type, err));
      return;
    }

    const transient = !providerReady || decision.reason === 'consent-pending';
    if (transient) {
      this.queues.enqueue(type, args as any, category, ctx);
      if (type === 'track' && decision.reason === 'consent-pending') this.consent?.promoteImplicitIfAllowed?.();
      return;
    }
    // blocked
    this.signalPolicyBlocked(decision.reason);
  }

  private drainPreInitBuffer() {
    const buffered = this.preInitBuffer.flush();
    this.executeQueuedEvents(buffered);
  }

  private flushQueues() {
    const fac = this.queues.flushFacade();
    const ssr = this.queues.flushSSR();
    this.executeQueuedEvents([...ssr, ...fac]);
  }

  private executeQueuedEvents(events: QueuedEventUnion[]) {
    events.forEach(e => this.execute({
      type: e.type as EventType,
      args: e.args,
      url: e.pageContext?.url,
      category: e.category,
    }));
  }

  private sendInitialPV() {
    if (!this.cfg?.autoTrack) return;
    const url = this.context.normalizeUrl(this.context.resolveCurrentUrl());
    if (this.context.isDuplicatePageview(url)) return;
    this.pageview();
  }

  private maybeStartAutotrack() {
    if (!this.cfg?.autoTrack) return;
    this.nav.start((url) => {
      if (!this.consent?.isAllowed(DEFAULT_CATEGORY)) return;
      this.execute({ type: 'pageview', url });
    });
  }

  private isProviderReady(): boolean {
    return this.providerIsReady;
  }

  private isConsentResolved(): boolean {
    const s = this.consent?.getStatus();
    return s === 'granted' || s === 'denied';
  }

  private maybeResolveReady() {
    // Idempotent: resolving an already-resolved deferred is a no-op
    if (this.isProviderReady()) {
      this.providerReady.resolve();
    }
    if (this.isProviderReady() && this.isConsentResolved()) {
      this.trackingReady.resolve();
    }
  }

  private attachProviderReadyHandlers() {
    this.provider.onReady(() => {
      this.forceQueue = false; // provider is safe to send to now
      this.providerIsReady = true;
      this.maybeResolveReady();

      if (this.consent?.getStatus() === 'granted') {
        this.flushQueues();
        this.sendInitialPV();
      }
      // Consent onChange already flushes/drops & resolves ready when != pending
      this.maybeStartAutotrack();
    });
  }

  private onOverflow(count: number) {
    if (this.overflowNotified) return;
    this.overflowNotified = true;
    logger.warn('Queue overflow; dropping events', { count });
    try {
      const err = new AnalyticsError(
        `Dropped ${count} event(s) due to queue overflow`,
        'QUEUE_OVERFLOW',
        this.provider.name(),
      );
      this.cfg?.onError?.(err);
    } catch {}
  }

  private signalPolicyBlocked(reason: string) {
    if (this.policyReasonsNotified.has(reason)) return;
    this.policyReasonsNotified.add(reason);
    logger.info('Event blocked by policy', { reason });
    try {
      const err = new AnalyticsError(
        `Event blocked by policy: ${reason}`,
        'POLICY_BLOCKED',
        this.provider.name(),
      );
      this.cfg?.onError?.(err);
    } catch {}
  }

  private signalProviderError(type: string, error: unknown) {
    logger.warn('Provider call errored', { type, error });
    try {
      const err = new AnalyticsError(
        `Provider error calling ${type}`,
        'PROVIDER_ERROR',
        this.provider.name(),
      );
      this.cfg?.onError?.(err);
    } catch {}
  }

  private async fallbackToNoop(error: unknown) {
    logger.warn('Invalid provider config – falling back to noop', { error });
    try { this.provider?.destroy(); } catch {}

    // Rebuild provider manager with noop options and wire the same handlers
    this.pCfg = { provider: 'noop' } as any;
    this.provider = new ProviderManager(this.pCfg, this.cfg);
    await this.provider.load();
    this.attachProviderReadyHandlers();
  }

  /** @internal test-only */
  setProvider(p: any) {
    // Delegate to ProviderManager test hook
    // (no public export; tests can use // @ts-expect-error)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    console.warn('Setting provider:', p.name);
    if (this.provider) {
      this.provider?.inject(p);
      this.forceQueue = false; // safe to send to the injected provider
      this.providerIsReady = true; 
      this.providerReady.resolve();
      if (this.isConsentResolved()) this.trackingReady.resolve();
    }

    // --- Pre-init injection path ---
    // Stash for init(); treat provider as ready for readiness purposes
    this._preInjectedProvider = p;
    this.forceQueue = false;
    this.providerIsReady = true; 
    this.providerReady.resolve();
    if (this.isConsentResolved()) this.trackingReady.resolve();
    // NOTE: do NOT call maybeResolveReady() here, it still references the manager.
    console.warn('Provider after set:', this.provider?.get()?.name);
  }

  /** @internal test-only */
  getProvider(): StatefulProvider | null {
    return this.provider?.get() ?? null;
  }

  /** @internal test-only */
  preInjectForTests(p: any) { this._preInjectedProvider = p; }
}
