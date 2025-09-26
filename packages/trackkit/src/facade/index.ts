import type { EventType, FacadeOptions, InitOptions, Props, ProviderOptions } from '../types';
import { mergeConfig, validateProviderConfig, getConsentConfig } from './config'; // existing
import { ConsentManager } from '../consent/ConsentManager';               // existing
import { ConsentCategory, ConsentStatus, ConsentStoredState } from '../consent/types';
import { PolicyGate } from './policy-gate';
import { ContextService } from './context';
import { QueueService } from './queues';
import { ProviderManager } from './provider-manager';
import { NavigationService } from './navigation';
import { Dispatcher } from '../dispatcher/dispatcher';
import { logger, createLogger, setGlobalLogger } from '../util/logger';   // existing
import { DEFAULT_CATEGORY, DEFAULT_PRE_INIT_BUFFER_SIZE, ESSENTIAL_CATEGORY } from '../constants';
import { AnalyticsError, dispatchError, setUserErrorHandler } from '../errors';
import { DiagnosticsService } from './diagnostics';
import { StatefulProvider } from '../providers/stateful-wrapper';
import { EventQueue, QueuedEventUnion } from '../util/queue';
import { isServer } from '../util/env';
import { ConnectionMonitor } from '../connection/monitor';
import { OfflineStore } from '../connection/offline-store';

/**
 * Wraps a promise and rejects on timeout.
 * - Resolves/rejects with the same value/error as `p` if it settles before the timer.
 * - Rejects with the value returned by `onTimeout()` (or an AnalyticsError) if the timer wins.
 * The resolved type is preserved (Promise<T> in, Promise<T> out).
 */
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
  private monitor: ConnectionMonitor | null = null;
  private offline: OfflineStore | null = null;

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
  private policyReasonsNotified = new Set<string>();

  private _preInjectedProvider: any | null = null;

  // Collect calls made before init() (when context/queues don’t exist yet)
  private preInitBuffer: EventQueue = new EventQueue({ maxSize: DEFAULT_PRE_INIT_BUFFER_SIZE });

  init(opts: InitOptions = {}): this {
    if (this.initPromise) return this;

    const resolved = mergeConfig(opts);
    this.cfg = resolved.facadeOptions;
    this.pCfg = resolved.providerOptions;

    setGlobalLogger(createLogger(!!this.cfg?.debug));
    logger.debug("Initializing analytics", { provider: this.pCfg.provider});

    setUserErrorHandler(this.cfg?.onError);

    this.context    = new ContextService(this.cfg!);
    this.queues     = new QueueService(this.cfg!, dropped => this.onOverflow(dropped.length));
    this.nav        = new NavigationService();
    this.dispatcher = new Dispatcher({
      batching: this.cfg?.batching?.enabled ? this.cfg.batching : undefined,
      performance: this.cfg?.performance,
    });

    // optional connection+offline
    this.monitor = this.cfg?.connection?.monitor ? new ConnectionMonitor({
      slowThreshold: this.cfg.connection?.slowThreshold, checkInterval: this.cfg.connection?.checkInterval
    }) : null;

    this.offline = this.cfg?.connection?.offlineStorage ? new OfflineStore() : null;

    try {
      validateProviderConfig(resolved);
      this.setupProviderDependencies();
    } catch (e) {
      dispatchError(e, 'INVALID_CONFIG', this.pCfg?.provider ?? 'unknown');
      this.setupFallbackNoopProvider();
    }

    // Consent transitions — attach ONCE per init (not in initialize)
    this.consent?.onChange((to, from) => {
      logger.info('Consent changed', { from, to });
      if (to === 'granted') this.flushQueues();
      if (to === 'denied')  this.consentDeniedFastFlush();
    });

    // If a test stashed a provider, inject it BEFORE load starts
    if (this._preInjectedProvider) {
      // @ts-ignore internal
      this.provider.inject(this._preInjectedProvider);
      this._preInjectedProvider = null;
      this.providerIsReady = true;
    }

    // drain offline on reconnect
    this.monitor?.subscribe(async (state) => {
      if (state === 'online' && this.offline) {
        const items = await this.offline.drainOffline();
        items.forEach(e => this.execute(e)); // re-checks policy/consent
      }
    });

    // Kick off provider load
    this.initPromise = this.initialize().finally(() => (this.initPromise = null));

    this.drainPreInitBuffer();

    return this;
  }

  private async initialize(): Promise<void> {
    try {
      this.attachProviderReadyHandlers();
      await this.provider.load();
    } catch (e) {
      // Try to recover by falling back to noop
      try {
        await this.fallbackToNoop(e);
      } catch (fallbackErr) {
        // Hard failure: make waiters fail fast
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
  getSnapshot(): ConsentStoredState | null {
    return this.consent?.snapshot() || null;
  }
  grantConsent() { this.consent?.grant(); }
  denyConsent() { this.consent?.deny(); }
  resetConsent() { this.consent?.reset?.(); }

  // Ready utilities

  /**
   * Wait for the SDK to be ready.
   *
   * There are two notions of "ready":
   * - "provider": the analytics provider has finished initializing (scripts loaded, SDK ready).
   *               Consent state is ignored. Use this when you just need the plumbing up.
   * - "tracking": the provider is ready AND the current policy gate allows sending analytics events
   *               for the given consent category (defaults to "analytics"). I.e., consent is granted
   *               (or otherwise allowed), DNT/domain gates pass, etc.
   *
   * By default we resolve for **provider** readiness because most callsites want “SDK initialized”
   * semantics. Use `{ mode: 'tracking' }` when you explicitly need “can send analytics now”.
   *
   * Returns:
   *   Promise<boolean> – resolves to `true` when the requested readiness is achieved;
   *   rejects with an AnalyticsError('READY_TIMEOUT') if the timeout elapses first.
   */
  public waitForReady(opts?: { timeoutMs?: number; mode?: 'tracking' | 'provider' }): Promise<boolean> {
    const mode = opts?.mode ?? 'provider';

    // Snapshot current readiness
    const providerReadyNow = !!this.isProviderReady();
    const consent = this.consent?.getStatus?.() ?? 'pending';
    const trackingReadyNow = providerReadyNow && consent === 'granted';

    if ((mode === 'provider' && providerReadyNow) ||
        (mode === 'tracking' && trackingReadyNow)) {
      return Promise.resolve(true);
    }

    const p = new Promise<boolean>((resolve) => {
      let done = () => { cleanup(); resolve(true); };
      let cleaners: Array<() => void> = [];

      // Provider readiness
      if (!providerReadyNow && this.provider?.onReady) {
        const off = this.provider.onReady(() => {
          if (mode === 'provider') {
            done();
          } else {
            // tracking: need consent granted too
            const s = this.consent?.getStatus?.() ?? 'pending';
            if (s === 'granted') done();
          }
        });
        if (typeof off === 'function') cleaners.push(off);
      }

      // Consent changes (only relevant for tracking mode)
      if (mode === 'tracking' && this.consent?.onChange) {
        const offConsent = this.consent.onChange((s) => {
          if (s === 'granted' && (this.isProviderReady() || providerReadyNow)) {
            done();
          }
        });
        if (typeof offConsent === 'function') cleaners.push(offConsent);
      }

      function cleanup() {
        for (const off of cleaners) { try { off(); } catch {} }
        cleaners = [];
      }
    });

    return withTimeout(p, opts?.timeoutMs);
  }

  getQueueSize(): number { return this.queues?.size() ?? this.preInitBuffer.size; }

  hasQueuedEvents(): boolean { return this.getQueueSize() > 0; }

  /**
   * Attempt to drain pending queues *if* conditions allow, and return how many
   * events were processed (sent or dropped by policy).
   *
   * Behavior by state:
   * - Provider NOT ready → no-op, returns 0.
   * - No ConsentManager → treat as unrestricted; drain all queues; return count.
   * - Consent = "granted" → drain all queues; return count.
   * - Consent = "pending" → process only "essential" events; analytics remain queued; return count of essentials processed.
   * - Consent = "denied"  → process only "essential" events if allowed by `allowEssentialOnDenied`;
   *                         analytics events are cleared/dropped. The return value includes the number of
   *                         essential events processed plus the number of analytics events dropped.
   *
   * Notes:
   * - “Processed” == attempted (sent or dropped), so this number can be >0 even if delivery was blocked.
   * - Safe and idempotent to call repeatedly.
   *
   * @returns {number} Number of events processed in this call.
   */
  async flushIfReady(): Promise<number> {
    if (!this.providerIsReady) return 0;

    const status = this.consent?.getStatus?.();

    let processed = 0;
    switch (status) {
      case 'granted':
      case undefined: // no consent manager => treat as granted
        // return this.executeQueuedEvents(this.queues.flushAll());
        processed += this.executeQueuedEvents(this.queues.flushAll());
        break;

      case 'pending':
        // run essentials now; keep analytics queued
        // return this.executeQueuedEvents(this.queues.flushEssential());
        processed += this.executeQueuedEvents(this.queues.flushEssential());
        break;

      case 'denied':
        // return this.consentDeniedFastFlush();
        processed += this.consentDeniedFastFlush();
        break;

      default:
        return 0;
    }

    // If batching is enabled, ensure pending batches are sent now.
    // This makes flushIfReady deterministic for tests and apps.
    if (this.dispatcher && typeof this.dispatcher.flush === 'function') {
      await this.dispatcher.flush();
    }

    return processed;
  }

  getDiagnostics() { return this.diag.getSnapshot(); }

  destroy() {
    this.nav.stop();
    this.dispatcher.destroy();
    this.provider.destroy();
    this.queues.clearAll();
    this.context.reset();
    setUserErrorHandler(null);
    this.providerIsReady = false;
    this._preInjectedProvider = null;
    this.preInitBuffer = new EventQueue({ maxSize: DEFAULT_PRE_INIT_BUFFER_SIZE });
  }

  // === Internals ===

  private execute({ type, args = [], url, category = DEFAULT_CATEGORY }: { type: EventType; args?: unknown[]; url?: string; category?: ConsentCategory; }) {
    // If init() hasn’t run yet, we don’t have context/queues. Buffer per instance.

    if (!this.context) {
      const bufferedCtx = url ? { url: url as string } : undefined;
      this.preInitBuffer.enqueue(type, args as any, category, bufferedCtx);
      return;
    }

    const resolvedUrl = this.context.normalizeUrl(url ?? this.context.resolveCurrentUrl());
    const ctx = this.context.buildPageContext(resolvedUrl, this.userId);

    if (isServer() && type !== 'identify') {
      this.queues.enqueue(type, args as any, category, ctx); 
      return;
    }

    if (this.monitor && !this.monitor.isHealthy() && this.offline) {
      // Fire-and-forget; storage may be sync (localStorage) or async (future IndexedDB)
      try {
        const maybePromise = this.offline.saveOffline([
          { type, args, url: resolvedUrl, category, timestamp: Date.now() }
        ]);
        // If it’s promise-like, don’t await—just catch to avoid unhandled rejections.
        if (maybePromise && typeof (maybePromise as any).then === 'function') {
          (maybePromise as Promise<void>).catch(() => { logger.error('offline save failed'); });
        }
      } catch {
        logger.error('offline save threw synchronously');
      }
      return;
    }

    const decision = this.policy.shouldSend(type, category, resolvedUrl);
    const providerReady = this.isProviderReady();

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
    if (transient && decision.reason !== 'consent-denied') {
      this.queues.enqueue(type, args as any, category, ctx);
      if (type === 'track' && decision.reason === 'consent-pending') this.consent?.promoteImplicitIfAllowed?.();
      return;
    }
    // blocked
    this.signalPolicyBlocked(decision.reason);
  }

  private drainPreInitBuffer() {
    const buffered = this.preInitBuffer.flush();
    return this.executeQueuedEvents(buffered);
  }

  private flushQueues(policy: 'execute-all' | 'execute-essential' = 'execute-all'): number {
    let events = this.queues.flushAll();
    if (policy === 'execute-essential') {
      events = events.filter(e => e.category === 'essential');
    }
    return this.executeQueuedEvents(events);
  }

  private consentDeniedFastFlush(): number {
    const essentialsAllowed = this.consent?.isAllowed('essential') ?? false;

    if (!essentialsAllowed) {
      // nothing is allowed; drop all fast
      return this.queues.clearAll();
    }

    // essentials allowed: execute essentials, then drop the rest
    const processed = this.executeQueuedEvents(this.queues.flushEssential());
    const dropped = this.queues.clearNonEssential();
    return processed + dropped;
  }

  private executeQueuedEvents(events: QueuedEventUnion[]) {
    events.forEach(e => this.execute({
      type: e.type as EventType,
      args: e.args,
      url: e.pageContext?.url,
      category: e.category,
    }));
    return events.length;
  }

  private sendInitialPV() {
    if (!this.cfg?.autoTrack) return;
    const url = this.context.normalizeUrl(this.context.resolveCurrentUrl());
    this.pageview(url);
  }

  private maybeStartAutotrack() {
    if (!this.cfg?.autoTrack) return;
    this.nav.start((url) => {
      this.execute({ type: 'pageview', url });
    });
  }

  private isProviderReady(): boolean {
    return this.providerIsReady;
  }

  private setupProviderDependencies() {
    this.consent    = new ConsentManager(getConsentConfig(this.cfg!, this.pCfg?.provider));
    this.policy     = new PolicyGate(this.cfg!, this.consent, this.pCfg?.provider || 'noop');
    this.provider   = new ProviderManager(this.pCfg!, this.cfg!);
    this.diag       = new DiagnosticsService(
      this.id, this.cfg!, this.consent as any, this.queues, this.context, this.provider, this.pCfg?.provider ?? null
    );
  }

  private attachProviderReadyHandlers() {
    if (!this.provider?.onReady) return;

    this.provider.onReady(() => {
      // Provider is now safe to talk to
      this.providerIsReady = true;

      // Enqueue initial PV now; PolicyGate decides send/queue/drop
      if (this.cfg?.autoTrack) this.sendInitialPV();

      // Start SPA listeners right away; PolicyGate will handle gating
      this.maybeStartAutotrack();

      // Flush behavior depends on consent
      this.flushIfReady();
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

  private setupFallbackNoopProvider() {
    try { this.provider?.destroy(); } catch {}
    this.pCfg = { provider: 'noop' } as any;
    this.setupProviderDependencies();
  }

  private async fallbackToNoop(error: unknown) {
    logger.warn('Invalid provider config – falling back to noop', { error });
    this.setupFallbackNoopProvider();
    await this.provider.load();
    this.attachProviderReadyHandlers();
  }

  /** @internal test-only */
  setProvider(p: any) {
    // Delegate to ProviderManager test hook
    // (no public export; tests can use // @ts-expect-error)
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    if (this.provider) {
      this.provider?.inject(p);
      this.providerIsReady = true; 
    }

    // --- Pre-init injection path ---
    // Stash for init(); treat provider as ready for readiness purposes
    this._preInjectedProvider = p;
    this.providerIsReady = true; 
  }

  /** @internal test-only */
  getProvider(): StatefulProvider | null {
    return this.provider?.get() ?? null;
  }

  /** @internal test-only */
  preInjectForTests(p: any) { this._preInjectedProvider = p; }

  /** @internal test-only */
  onConsentChange(cb: (status: ConsentStatus) => void): () => void {
    return this.consent?.onChange(cb) ?? (() => {});
  }
}
