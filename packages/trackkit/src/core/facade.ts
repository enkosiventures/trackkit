import type { AnalyticsInstance, EventType, FacadeOptions, InitOptions, PageContext, Props, ProviderOptions } from '../types';
import { dispatchError, AnalyticsError, setUserErrorHandler } from '../errors';
import { createLogger, logger, setGlobalLogger } from '../util/logger';
import { EventQueue, QueuedEventUnion } from '../util/queue';
import { validateConfig, mergeConfig, getConsentConfig } from './config';
import { isSSR, hydrateSSRQueue, getSSRQueue, getSSRQueueLength } from '../util/ssr-queue';
import { ConsentManager } from '../consent/ConsentManager';
import type { StatefulProvider } from '../providers/stateful-wrapper';
import { ensureNavigationSandbox } from '../providers/shared/navigationSandbox';
import { getPageContext, isDomainAllowed, isUrlExcluded, isDoNotTrackEnabled, isLocalhost } from '../providers/shared/browser';
import { isBrowser } from '../util/env';
import { ConsentCategory } from '../consent/types';
import { DEFAULT_CATEGORY, ESSENTIAL_CATEGORY } from '../constants';
import { getProviderMetadata } from '../providers/metadata';
import { loadProvider } from '../providers/loader';


const facadeDebugLog = (message: string, ...args: unknown[]): void => {
  logger.debug(`[FACADE] ${message}`, ...args);
}

type SendDecision = { 
  ok: boolean;
  reason: 'ok'|'not-browser'|'no-provider'|'provider-not-ready'|'consent-pending'|'consent-denied'|'dnt'|'localhost'|'domain-not-allowed'|'url-excluded';
};


/**
 * Main analytics facade that manages the lifecycle of analytics tracking
 * Acts as a stable API surface while providers and state can change
 */
export class AnalyticsFacade implements AnalyticsInstance {
  readonly id = `AF_${Math.random().toString(36).substring(2, 10)}`;
  readonly name = 'analytics-facade';
  
  // Core state
  private queue: EventQueue;
  private provider: StatefulProvider | null = null;
  private consent: ConsentManager | null = null;
  private initPromise: Promise<void> | null = null;
  private currentUserId: string | null = null;
  private config: FacadeOptions | null = null;
  private providerConfig: ProviderOptions | null = null;
  private navUnsub: (() => void) | null = null;
  
  // Tracking state
  /**
   * Last scheduled pageview URL (either sent immediately or enqueued).
   * Used to dedupe scheduling (avoid queuing duplicate PVs while consent is pending).
   */
  private lastPlannedUrl: string | null = null; // for SPA navigation

  /**
   * Last actually delivered pageview URL. Used for SPA referrer.
   */
  private lastSentUrl: string | null = null;
  
  constructor() {
    // Initialize with default queue config
    this.queue = new EventQueue({
      maxSize: 50, // Will be updated on init
      debug: false,
      onOverflow: (dropped) => {
        this.handleQueueOverflow(dropped);
      },
    });
  }

  // ================ Public API ================
  
  init(options: InitOptions = {}): this {
    facadeDebugLog("Initializing analytics facade:", this.id);
    if (this.provider || this.initPromise) {
      logger.warn('Analytics already initialized');
      return this;
    }
    
    try {
      const resolved = mergeConfig(options);

      // Set config before validation to ensure noop provider still has
      // access to any valid user-provided options as well as default fallbacks
      this.config = resolved.facadeOptions;
      this.providerConfig = resolved.providerOptions;
      facadeDebugLog("Config merged", resolved);

      this.configureLogger(this.config);

      setUserErrorHandler(this.config?.onError);
      facadeDebugLog("User error handler set", this.config?.onError);

      validateConfig(resolved);
      facadeDebugLog("Config validated");

      // Update queue with final config
      this.reconfigureQueue(this.config);
      facadeDebugLog("Queue reconfigured", this.queue);

      // Create consent manager synchronously
      const consentConfig = getConsentConfig(this.config, this.providerConfig?.provider);
      this.consent = new ConsentManager(consentConfig);
      facadeDebugLog("Consent manager created", this.consent.getStatus());

      // Start async initialization
      this.initPromise = this.initializeAsync()
        .catch(async (error) => {
          // Handle init failure by falling back to noop
          await this.handleInitFailure(error);
        })
        .finally(() => {
          this.initPromise = null;
        });
      
      logger.info('Initializing analytics', {
        provider: this.providerConfig?.provider,
        queueSize: this.config?.queueSize,
        debug: this.config?.debug,
      });

    } catch (error) {
      // Synchronous errors (validation, etc)
      this.handleInitError(error);

      // Fall back to noop so API remains usable
      this.startFallbackNoop(error);
    }

    return this;
  }

  track(name: string, props?: Props, category: ConsentCategory = DEFAULT_CATEGORY): void {
    facadeDebugLog('Facade track called', name, props, category);
    this.execute({type: 'track', args: [name, props], category});
  }
  
  pageview(): void {
    this.execute({type: 'pageview'});
  }
  
  identify(userId: string | null): void {
    this.currentUserId = userId;
    this.execute({type: 'identify', args: [userId], category: ESSENTIAL_CATEGORY});
  }

  destroy(): void {
    facadeDebugLog('[DESTROY] AnalyticsFacade.destroy called');
    // Destroy provider
    try {
      this.provider?.destroy();
    } catch (error) {
      logger.error("Provider destroy failed");
      dispatchError(new AnalyticsError(
        'Provider destroy failed',
        'PROVIDER_ERROR',
        this.providerConfig?.provider,
        error
      ));
    }

    // Stop auto-tracking
    this.stopAutotrack();
    
    // Clear all state
    this.provider = null;
    this.consent = null;
    this.initPromise = null;
    this.lastPlannedUrl = null;
    this.lastSentUrl = null;
    this.currentUserId = null;
    this.config = null;
    this.providerConfig = null;
    this.navUnsub?.();
    this.navUnsub = null;

    // Reset error handler
    setUserErrorHandler(null);
    
    // Clear queues
    this.clearAllQueues();
    
    logger.info('Analytics destroyed');
  }
  
  async waitForReady(): Promise<StatefulProvider> {
    if (this.provider) return this.provider;
    if (this.initPromise) await this.initPromise;
    if (!this.provider) {
      throw new AnalyticsError(
        'Analytics not initialized',
        'INIT_FAILED',
        this.providerConfig?.provider
      );
    }
    return this.provider;
  }
  
  getDiagnostics(): Record<string, any> {
    return {
      id: this.id,
      hasProvider: !!this.provider,
      providerReady: this.provider ? 
        (this.provider as any).state?.getState() === 'ready' : false,
      queueState: this.queue.getState(),
      facadeQueueSize: this.queue.size,
      ssrQueueSize: getSSRQueueLength(),
      totalQueueSize: this.getTotalQueueSize(),
      initializing: !!this.initPromise,
      provider: this.providerConfig?.provider ?? null,
      consent: this.consent?.getStatus() ?? null,
      debug: this.config?.debug ?? false,
      lastSentUrl: this.lastSentUrl,
      lastPlannedUrl: this.lastPlannedUrl,
    };
  }

  // ------------------ Initialization Logic --------------
  private async initializeAsync(): Promise<void> {
    try {
      // Load provider and create consent manager
      // this.provider = await this.loadProviderAsync();
      const loaded = await this.loadProviderAsync();

      // If tests (or app) injected a provider meanwhile, don't overwrite it.
      if (this.provider) {
        facadeDebugLog('Provider already present; discarding loaded provider');
        try { loaded.destroy(); } catch {}
        // Still wire consent callbacks to the existing provider if needed.
        this.setupConsentCallbacks();
        if (!isSSR()) this.handleSSRHydration();
        return;
      }

      // Set the provider
      this.provider = loaded;

      // Set up provider callbacks
      this.setupProviderCallbacks();
      
      // Set up consent callbacks
      this.setupConsentCallbacks();
      
      // Handle SSR queue if in browser
      if (!isSSR()) {
        this.handleSSRHydration();
      }
      
      logger.info('Analytics initialized successfully', {
        provider: this.providerConfig?.provider,
      });
      
    } catch (error) {
      logger.error("Failed to initialize analytics");
      throw error instanceof AnalyticsError ? error : new AnalyticsError(
        'Failed to initialize analytics',
        'INIT_FAILED',
        this.providerConfig?.provider,
        error
      );
    }
  }

  private configureLogger(options: FacadeOptions | null): void {
    setGlobalLogger(createLogger(!!options?.debug));
  }

  private async loadProviderAsync(): Promise<StatefulProvider> {
    const provider = await loadProvider(
      this.providerConfig,
      this.config?.cache,
      this.config?.debug,
      this.config?.onError,
    );
  
    return provider;
  }

  private setupProviderCallbacks(): void {
    if (!this.provider) return;
    
    // Provider ready callback
    this.provider.onReady(() => {
      logger.info('Provider ready, checking for consent and queued events');
      
      // Flush queues if consent granted
      facadeDebugLog("Provider ready callback called", {
        provider: this.provider?.name,
        consentManager: this.consent,
        consentStatus: this.consent?.getStatus(),
      });
      if (this.consent?.getStatus() === 'granted') {
        this.flushAllQueues();
        this.sendInitialPageview();
      } else {
        // arm a one-shot for landing hit when consent is granted later
        this.consent?.onChange((status) => {
          if (status === 'granted') {
            this.flushAllQueues();
            this.sendInitialPageview();
          }
        });
      }

      // Start auto-tracking if enabled
      facadeDebugLog("maybeStartAutotrack called in onReady");
      this.maybeStartAutotrack();
    });
  }

  private setupConsentCallbacks(): void {
    if (!this.consent) {
      logger.warn('No consent manager available, skipping consent setup');
      facadeDebugLog("No consent manager available, skipping consent setup");
      return;
    }
    
    this.consent.onChange((status, prevStatus) => {
      facadeDebugLog("Consent changed callback called. Consent manager status:", status);
      facadeDebugLog("This provider:", this.provider);
      logger.info('Consent changed', { from: prevStatus, to: status });
      
      if (status === 'granted' && this.provider) {
        // Check if provider is ready
        const providerReady = this.provider.getState().provider === 'ready';
        
        facadeDebugLog("Provider status:", this.provider.getState());
        facadeDebugLog("Provider ready state:", providerReady);
        if (providerReady) {
          facadeDebugLog("consent granted with provider ready")
          // Flush queued events
          if (this.getTotalQueueSize() > 0) {
            this.flushAllQueues();
          }
        }
        // If not ready, the onReady callback will handle it
        
      } else if (status === 'denied') {
        // Clear facade queue but preserve SSR queue
        this.queue.clear();
      }
    });
  }

  // ================ Queue Management ================

  private execute(opts: { type: EventType; args?: unknown[]; url?: string; category?: ConsentCategory }): void {
    const { type, args = [], url, category = DEFAULT_CATEGORY } = opts;
    const resolvedUrl = this.normalizeUrl(url ?? this.resolveCurrentUrl());
    const pageContext = this.buildPageContext(resolvedUrl);

    // SSR: always queue
    if (isSSR()) {
      facadeDebugLog('execute failed as isSSR, queuing');
      getSSRQueue().push({
        id: `ssr_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
        category,
        pageContext,
      } as QueuedEventUnion);
      return;
    }

    // Check if duplicate pageview
    if (type === 'pageview' && this.lastPlannedUrl === resolvedUrl) {
      facadeDebugLog('execute aborted duplicate pageview', { url: resolvedUrl });
      return;
    }
    
    // Check if we can send immediately
    facadeDebugLog("[EXEC] config:", this.config);
    const decision = this.shouldSend(type, category, resolvedUrl);
    if (this.provider && decision.ok) {
      facadeDebugLog('Provider ready & policy pass', {
        provider: this.provider?.name,
        state: this.provider?.getState().provider,
      });
      try {
        // @ts-expect-error - dynamic dispatch
        this.provider[type](...args, pageContext);
        facadeDebugLog("Current provider:", this.provider?.name);
        this.onExecuteSuccess(type, resolvedUrl);
      } catch (error) {
        dispatchError(new AnalyticsError(
          `Error executing ${type}`,
          'PROVIDER_ERROR',
          this.providerConfig?.provider,
          error
        ));
      }
      return;
    } else {
      facadeDebugLog(
        `Provider not ready or should not send ${type}`,
        { type, args, url: resolvedUrl, shouldSend: decision.ok, reason: decision.reason },
      );
      facadeDebugLog(
        `Provider not ready or should not send ${type}`,
        { type, args, url: resolvedUrl, shouldSend: decision.ok, reason: decision.reason },
      );
      facadeDebugLog("provider", this.provider);
    }

    // Determine if we should queue or drop
    const policyBlocked = !decision.ok && decision.reason !== 'consent-pending';
    const transient = (!this.provider && decision.ok) || decision.reason === 'consent-pending';

    if (policyBlocked) {
      if (decision.reason === 'consent-denied') {
        this.consent?.incrementDroppedDenied();
        facadeDebugLog(`Event dropped due to consent denial: ${type}`, { args });
      }
      dispatchError(new AnalyticsError(
        `Event blocked by policy (${decision.reason})`,
        'POLICY_BLOCKED',
        this.providerConfig?.provider
      ));
      return;
    }

    if(transient) {
      // Queue while pending or provider not ready
      const eventId = this.queue.enqueue(
        type,
        args as any,
        category,
        pageContext,
      );

      if (eventId) {
        this.consent?.incrementQueued();
        facadeDebugLog(`Event queued: ${type}`, { 
          eventId, 
          queueSize: this.queue.size,
          reason: !this.provider ? 'no provider' : 'consent pending'
        });

        // Check for implicit consent promotion on first track
        if (type === 'track' && decision.reason === 'consent-pending') {
          this.consent?.promoteImplicitIfAllowed();
        }

        // if (type === 'pageview') {
        //   this.lastPlannedUrl = resolvedUrl; // remember for deduping
        // }
      }
    }

    // Essential events will be permitted by this.shouldSend if allowEssentialOnDenied is true
    const consentStatus = this.consent?.getStatus();
    if (consentStatus === 'denied') { 
      facadeDebugLog('consent denied, dropping event');
      this.consent?.incrementDroppedDenied();
      facadeDebugLog(`Event dropped due to consent denial: ${type}`, { args });
      return;
    }
  }

  private onExecuteSuccess(type: EventType, url: string): void {
    facadeDebugLog(`Execution successful for ${type}`, { url });
    if (type === 'pageview') {
      this.lastPlannedUrl = url; 
      this.lastSentUrl = url; // used for SPA referrer
    }
  }

  /** Central policy gate for both pageviews and events. */
  private shouldSend(type: EventType, category: ConsentCategory, url?: string): SendDecision {
    // Environment/SSR
    if (!isBrowser()) return { ok: false, reason: 'not-browser' };
    facadeDebugLog("[SHOULD_SEND] isBrowser check passed", { type, category, url });

    // Consent
    if (!this.consent?.isAllowed(category)) {
      const status = this.consent?.getStatus();
      if (status === 'denied') {
        return { ok: false, reason: 'consent-denied' };
      } else {
      return { ok: false, reason: 'consent-pending' };
      }
    }
    facadeDebugLog("[SHOULD_SEND] Consent check passed", { type, category, url });

    // DNT (respect by default)
    if (this.config?.doNotTrack !== false && isDoNotTrackEnabled()) return { ok: false, reason: 'dnt' };
    facadeDebugLog("[SHOULD_SEND] DNT check passed", { type, category, url });

    // Localhost policy (default: provider-set)
    const meta = getProviderMetadata(this.providerConfig?.provider || 'noop');
    const allowLocalhostDefault = meta?.trackLocalhost ?? true;
    const allowLocalhost = this.config?.trackLocalhost ?? allowLocalhostDefault;
    if (!allowLocalhost && isLocalhost()) return { ok: false, reason: 'localhost' };
    facadeDebugLog("[SHOULD_SEND] Localhost check passed", { type, category, url });

    // Pageview-specific filters
    if (type === 'pageview') {
      if (!isDomainAllowed(this.config?.domains)) return { ok: false, reason: 'domain-not-allowed' };
      if (url && isUrlExcluded(url, this.config?.exclude)) return { ok: false, reason: 'url-excluded' };
    }
    facadeDebugLog("[SHOULD_SEND] Domain and URL checks passed", { type, category, url });

    // Provider readiness is checked by caller (we know if this.provider exists)
    return { ok: true, reason: 'ok' };
  }

  private flushAllQueues(): void {
    // First flush SSR queue
    if (!isSSR()) {
      this.flushSSRQueue();
    }

    // Then flush facade queue
    facadeDebugLog("Flushing facade queue", this.queue);
    this.flushFacadeQueue();
  }

  private flushSSRQueue(): void {
    const ssrEvents = hydrateSSRQueue();
    if (ssrEvents.length === 0) {
      logger.info('No SSR events to replay');
      return;
    }
    logger.info('Replaying SSR events');
    this.replayEvents(ssrEvents);
  }

  private flushFacadeQueue(): void {
    if (this.queue.isEmpty) {
      logger.info('No facade events to replay');
      return;
    }
    logger.info(`Flushing queued facade events`);
    const queuedEvents = this.queue.flush();

    facadeDebugLog(`Flushing facade queue ${this.id}`, { queuedEvents }, this.queue);
    this.replayEvents(queuedEvents);
  }
  
  private replayEvents(events: QueuedEventUnion[]): void {
    if (!this.provider) {
      logger.error('No provider available to replay events');
      return;
    }
    logger.info(`Replaying ${events.length} events through provider ${this.provider.name}`);

    for (const event of events) {
      facadeDebugLog("Replaying queued event", { event });
      const { type, args, category, pageContext } = event;
      try {
        this.execute({ type, args, category, url: pageContext?.url });
      } catch (error) {
        dispatchError(new AnalyticsError(
          `Error replaying queued event: ${event.type}`,
          'PROVIDER_ERROR',
          this.providerConfig?.provider,
          error
        ));
      }
    }
  }
  
  private clearAllQueues(): void {
    // Clear facade queue
    this.queue.clear();
    
    // Clear SSR queue
    if (!isSSR()) {
      hydrateSSRQueue(); // This clears the queue
    }
  }
  
  private getTotalQueueSize(): number {
    const facadeSize = this.queue.size;
    const ssrSize = getSSRQueueLength();
    return facadeSize + ssrSize;
  }

  // ================ Pageview Handling ================

  private handleSSRHydration(): void {
    // This is called during initialization in browser
    // Don't flush immediately - wait for consent
    const ssrQueue = getSSRQueue();
    if (ssrQueue.length > 0) {
      logger.info(`Found ${ssrQueue.length} SSR events to hydrate`);
    }
  }
  
  private sendInitialPageview(): void {
    // Only schedule once; consent/ready/SSR handled in executeWithCtx()
    if (this.lastPlannedUrl !== null) return;   // something already scheduled

    if (!this.config?.autoTrack) return;
    if (!isBrowser()) return;

    this.execute({type: 'pageview'});
  }

  // ================ Navigation Handling ================

  /** Apply facade policy to any URL: strip hash if !includeHash, then apply urlTransform if provided. */
  private normalizeUrl(url: string): string {
    let out = url ?? '/';
    if (!this.config?.includeHash) {
      // drop the hash by default
      out = out.replace(/#.*$/, '');
    }
    if (this.config?.urlTransform) {
      out = this.config.urlTransform(out);
    }
    return out;
  }

  private normalizeReferrer(ref: string): string {
    if (!ref) return '';

    // In SSR we can't reliably resolve same-origin; return as-is (usually already no hash).
    if (typeof window === 'undefined') return ref;

    try {
      // Resolve relative refs against our origin.
      const url = new URL(ref, window.location.origin);

      if (url.origin === window.location.origin) {
        // Same-origin: apply the *same* URL policy (includeHash + urlTransform).
        // Build a pathish candidate first, then normalize.
        const candidate = url.pathname + url.search + url.hash;
        return this.normalizeUrl(candidate);
      }

      // Cross-origin: do not rewrite. (Browsers don’t send fragments in Referer anyway.)
      return ref;
    } catch {
      // Likely already a relative path; treat as same-origin and normalize.
      return this.normalizeUrl(ref);
    }
  }

  /** Single source of truth for “current URL”. */
  private resolveCurrentUrl(): string {
    if (this.config?.urlResolver) {
      // Caller takes full control; we still enforce transform (but not includeHash).,
      // OR, if you want to enforce hash policy even with custom resolver, run normalizeUrl instead.
      return this.config.urlResolver();
    }

    if (typeof window === 'undefined') return '/';

    // Always build the fully-detailed URL (including hash). normalizeUrl() will strip the hash if !includeHash.
    return window.location.pathname + window.location.search + window.location.hash;
  }

  private buildPageContext(url: string): PageContext {
    // Initial PV uses document.referrer; SPA uses the last *sent* URL
    const referrer =
      this.lastSentUrl === null
        ? (typeof document !== 'undefined' ? this.normalizeReferrer(document.referrer) : '')
        : this.lastSentUrl;

    return {
      ...getPageContext(url),
      userId: this.currentUserId || undefined,
      referrer,
    };
  }

  private maybeStartAutotrack() {
    facadeDebugLog('maybeStartAutotrack called', {
      autoTrack: this.config?.autoTrack,
      isBrowser: isBrowser(),
      navUnsub: this.navUnsub,
    });
    if (!this.config?.autoTrack) return;
    if (this.navUnsub) return;
    if (!isBrowser()) return;

    logger.info('Starting autotracking');
    const sandbox = ensureNavigationSandbox(window);
    this.navUnsub = sandbox.subscribe((url: string) => {
      facadeDebugLog(`[AUTOTRACK] url: ${url}, consent status: ${this.consent?.getStatus()}`);
      if (!this.consent?.isAllowed(DEFAULT_CATEGORY)) {
        // Pre-consent SPA navigations are **not** scheduled
        return;
      }
      this.execute({type: 'pageview', url});
    });
  }

  private stopAutotrack() {
    logger.info('Autotracking stopped');
    this.navUnsub?.();
    this.navUnsub = null;
    this.lastPlannedUrl = null;
    this.lastSentUrl = null;
  }

  // ================ Error Handling ================

  private handleInitError(error: unknown): void {
    const analyticsError = error instanceof AnalyticsError ? error :
      new AnalyticsError(
        String(error),
        'INIT_FAILED',
        this.providerConfig?.provider,
        error
      );

    dispatchError(analyticsError);
  }

  private async handleInitFailure(error: unknown): Promise<void> {
    const wrapped = error instanceof AnalyticsError ? error :
      new AnalyticsError(
        'Failed to initialize analytics',
        'INIT_FAILED',
        this.providerConfig?.provider,
        error
      );

    dispatchError(wrapped);
    logger.error('Initialization failed – falling back to noop', wrapped);

    // Try to load noop provider
    try {
      this.providerConfig = { provider: 'noop' };
      const normalized = {
        facadeOptions: this.config,
        providerOptions: this.providerConfig,
      }
      this.configureLogger(this.config);

      const provider = await this.loadProviderAsync();
      this.provider = provider;

      const consentConfig = getConsentConfig(this.config, this.providerConfig?.provider);
      this.consent = new ConsentManager(consentConfig);

      this.setupProviderCallbacks();
      this.setupConsentCallbacks();

    } catch (noopError) {
      const fatalError = new AnalyticsError(
        'Failed to load fallback provider',
        'INIT_FAILED',
        'noop',
        noopError
      );
      dispatchError(fatalError);
      logger.error('Fatal: fallback noop load failed', fatalError);
    }
  }

  private startFallbackNoop(error: unknown): void {
    logger.warn('Invalid config – falling back to noop');

    // Set noop provider config
    this.providerConfig = { provider: 'noop' };

    // Start loading noop
    this.initPromise = this.handleInitFailure(error)
      .finally(() => {
        this.initPromise = null;
      });
  }

  private handleQueueOverflow(dropped: QueuedEventUnion[]): void {
    const error = new AnalyticsError(
      `Queue overflow: ${dropped.length} events dropped`,
      'QUEUE_OVERFLOW',
      this.providerConfig?.provider
    );

    // Log details about dropped events
    logger.warn('Queue overflow', {
      droppedCount: dropped.length,
      oldestDropped: new Date(dropped[0].timestamp),
      eventTypes: dropped.map(e => e.type),
    });

    dispatchError(error);
  }

  // ================ Utilities ================

  private reconfigureQueue(config: FacadeOptions | null): void {
    const maxSize = config?.queueSize ?? 50;
    const debug   = config?.debug;

    if (!this.queue) {
      this.queue = new EventQueue({
        maxSize,
        debug,
        onOverflow: (dropped) => this.handleQueueOverflow(dropped),
      });
    } else {
      this.queue.reconfigure({
        maxSize,
        debug,
        onOverflow: (dropped) => this.handleQueueOverflow(dropped),
      });
    }
  }

  // ================ Setters & Getters for Testing ================
  setProvider(provider: StatefulProvider): void {
    logger.info("Analytics facade:", this.id);
    logger.info("Setting provider manually")
    this.provider = provider;
    this.setupProviderCallbacks();
    logger.info("Provider callbacks setup")
    this.setupConsentCallbacks();
    logger.info("Consent callbacks setup")
    this.maybeStartAutotrack();
    logger.info("Maybe autotrack started")
  }

  getProvider(): StatefulProvider | null {
    return this.provider;
  }

  getConsentManager(): ConsentManager | null {
    return this.consent;
  }

  getQueue(): EventQueue {
    return this.queue;
  }

  hasQueuedEvents(): boolean {
    return this.getTotalQueueSize() > 0;
  }

  flushIfReady(): void {
    if (this.provider && this.consent?.getStatus() === 'granted' && this.hasQueuedEvents()) {
      facadeDebugLog("flushIfReady called, flushing all queues");
      this.flushAllQueues();
    }
  }
}