import type { AnalyticsInstance, AnalyticsOptions, EventType, PageContext, Props } from '../types';
import { dispatchError, AnalyticsError, setUserErrorHandler } from '../errors';
import { debugLog, logger } from '../util/logger';
import { EventQueue, QueuedEventUnion } from '../util/queue';
import { validateConfig, mergeConfig, getConsentConfig } from './config';
import { loadProviderAsync } from './initialization';
import { isSSR, hydrateSSRQueue, getSSRQueue, getSSRQueueLength } from '../util/ssr-queue';
import { ConsentManager } from '../consent/ConsentManager';
import type { StatefulProvider } from '../providers/stateful-wrapper';
import { ensureNavigationSandbox } from '../providers/shared/navigationSandbox';
import { getPageContext, isDomainAllowed, isUrlExcluded, getPageUrl } from '../providers/shared/browser';


/**
 * Main analytics facade that manages the lifecycle of analytics tracking
 * Acts as a stable API surface while providers and state can change
 */
export class AnalyticsFacade implements AnalyticsInstance {
  readonly name = 'analytics-facade';
  
  // Core state
  private queue: EventQueue;
  private provider: StatefulProvider | null = null;
  private consent: ConsentManager | null = null;
  private config: AnalyticsOptions | null = null;
  private initPromise: Promise<void> | null = null;
  private navUnsub: (() => void) | null = null;
  private lastPageviewUrl: string | null = null;
  
  // Tracking state
  private initialPageviewSent = false;
  private lastSentUrl: string | null = null;   // for de-dupe
  private previousUrl: string | null = null;   // for SPA referrer
  private firstSent = false;
  // private errorHandler: ((e: AnalyticsError) => void) | undefined;
  
  constructor() {
    // Initialize with default queue config
    this.queue = new EventQueue({
      maxSize: 50, // Will be updated on init
      debug: false,
      onOverflow: (dropped) => {
        logger.warn(`Dropped ${dropped.length} events due to queue overflow`);
        this.handleQueueOverflow(dropped);
      },
    });
  }

  // ================ Public API ================
  
  init(options: AnalyticsOptions = {}): this {
    if (this.provider || this.initPromise) {
      logger.warn('Analytics already initialized');

      if (this.optionsDifferMeaningfully(options)) {
        logger.warn(
          'init() called with different options while initialization in progress; ignoring new options'
        );
      }
      return this;
    }
    
    try {
      const config = mergeConfig(options);

      this.config = config;
      setUserErrorHandler(config.onError);

      validateConfig(config);

      // Update queue with final config
      this.reconfigureQueue(config);

      // Create consent manager synchronously
      const consentConfig = getConsentConfig(config);
      this.consent = new ConsentManager(consentConfig);
      debugLog("[FACADE] Consent manager created", this.consent.getStatus());

      // Start async initialization
      this.initPromise = this.initializeAsync(config)
        .catch(async (error) => {
          // Handle init failure by falling back to noop
          await this.handleInitFailure(error, config);
        })
        .finally(() => {
          this.initPromise = null;
        });
      
      logger.info('Initializing analytics', {
        provider: config.provider,
        queueSize: config.queueSize,
        debug: config.debug,
      });

    } catch (error) {
      // Synchronous errors (validation, etc)
      this.handleInitError(error);

      // Fall back to noop so API remains usable
      this.startFallbackNoop(error);
    }

    return this;
  }

  track(name: string, props?: Props, url?: string): void {
    debugLog('Facade track called', name);
    this.execute('track', [name, props, url]);
  }
  
  pageview(url?: string): void {
    this.execute('pageview', [url]);
  }
  
  identify(userId: string | null): void {
    this.execute('identify', [userId]);
  }

  destroy(): void {
    // Destroy provider
    try {
      this.provider?.destroy();
    } catch (error) {
      logger.error("Provider destroy failed");
      dispatchError(new AnalyticsError(
        'Provider destroy failed',
        'PROVIDER_ERROR',
        this.config?.provider,
        error
      ));
    }
    
    // Clear all state
    this.provider = null;
    this.consent = null;
    this.config = null;
    this.initPromise = null;
    this.initialPageviewSent = false;

    // Reset error handler
    setUserErrorHandler(null);
    
    // Clear queues
    this.clearAllQueues();

    // Stop auto-tracking
    this.stopAutotrack();
    
    logger.info('Analytics destroyed');
  }
  
  async waitForReady(): Promise<StatefulProvider> {
    if (this.provider) return this.provider;
    if (this.initPromise) await this.initPromise;
    if (!this.provider) {
      throw new AnalyticsError(
        'Analytics not initialized',
        'INIT_FAILED',
        this.config?.provider
      );
    }
    return this.provider;
  }
  
  getDiagnostics(): Record<string, any> {
    return {
      hasProvider: !!this.provider,
      providerReady: this.provider ? 
        (this.provider as any).state?.getState() === 'ready' : false,
      queueState: this.queue.getState(),
      facadeQueueSize: this.queue.size,
      ssrQueueSize: getSSRQueueLength(),
      totalQueueSize: this.getTotalQueueSize(),
      initializing: !!this.initPromise,
      provider: this.config?.provider ?? null,
      consent: this.consent?.getStatus() ?? null,
      debug: this.config?.debug ?? false,
      initialPageviewSent: this.initialPageviewSent,
    };
  }

  // ------------------ Initialization Logic --------------
  
  private async initializeAsync(config: AnalyticsOptions): Promise<void> {
    try {
      // Load provider and create consent manager
      const provider = await loadProviderAsync(config);
      
      this.provider = provider;

      
      // Set up provider callbacks
      this.setupProviderCallbacks();
      
      // Set up consent callbacks
      this.setupConsentCallbacks();
      
      // Handle SSR queue if in browser
      if (!isSSR()) {
        this.handleSSRHydration();
      }
      
      logger.info('Analytics initialized successfully', {
        provider: config.provider,
      });
      
    } catch (error) {
      throw error instanceof AnalyticsError ? error : new AnalyticsError(
        'Failed to initialize analytics',
        'INIT_FAILED',
        config.provider,
        error
      );
    }
  }

  private setupProviderCallbacks(): void {
    if (!this.provider) return;
    
    // const getConsentManager = this.getConsentManager;
    // Provider ready callback
    this.provider.onReady(() => {
      debugLog("[FACADE] On ready callback called");
      debugLog("[FACADE] Consent manager:", this.getConsentManager());
      debugLog("[FACADE] This:", this);
      const granted = this.getConsentState();
      debugLog('[FACADE] Consent state in onReady:', granted);

      logger.info('Provider ready, checking for consent and queued events');
      
      // Flush queues if consent granted
      if (granted === true) {
        debugLog("[FACADE] Consent granted - flushing queues and sending initial pageview");
        this.flushAllQueues();
        this.sendInitialPageview();
      } else {
        // arm a one-shot for landing hit when consent is granted later
        this.consent?.onChange((status) => {
          if (status === 'granted') {
            debugLog('[FACADE] Consent granted (onChange in onReady) - flushing queues and sending initial pageview');
            this.flushAllQueues();
            this.sendInitialPageview();
          }
        });
      }

      // Start auto-tracking if enabled
      debugLog("[FACADE] maybeStartAutotrack called in onReady");
      this.maybeStartAutotrack();
    });
    
    // Navigation callback for SPA tracking
    // this.provider.setNavigationCallback?.((url: string) => {
    //   // Route navigation pageviews through facade for consent check
    //   this.pageview(url);
    // });
  }

  private setupConsentCallbacks(): void {
    if (!this.consent) return;
    
    this.consent.onChange((status, prevStatus) => {
      debugLog("[FACADE] Consent changed callback called. Consent manager status:", status);
      debugLog("[FACADE] Consent granted?:", this.getConsentState());
      debugLog("[FACADE] This provider:", this.provider);
      logger.info('Consent changed', { from: prevStatus, to: status });
      
      if (status === 'granted' && this.provider) {
        // Check if provider is ready
        const providerReady = this.provider.getState().provider === 'ready';
        
        debugLog("[FACADE] Provider status:", this.provider.getState());
        debugLog("[FACADE] Provider ready state:", providerReady);
        if (providerReady) {
          debugLog("[FACADE] consent granted with provider ready")
          // Flush queued events
          if (this.getTotalQueueSize() > 0) {
            this.flushAllQueues();
          }
          // Send initial pageview if not sent
          debugLog("[FACADE] Initial pageview sent:", this.initialPageviewSent);
          this.sendInitialPageview();
        }
        // If not ready, the onReady callback will handle it
        
      } else if (status === 'denied') {
        // Clear facade queue but preserve SSR queue
        this.queue.clear();
      }
    });
  }

  // ================ Queue Management ================
  
  private execute(type: EventType, args: unknown[]): void {
    debugLog('Executing:', type, args);

    const pageContext = this.buildPageContext();

    // SSR: always queue
    if (isSSR()) {
      debugLog('execute failed as isSSR, queuing');
      getSSRQueue().push({
        id: `ssr_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
        pageContext,
      } as QueuedEventUnion);
      return;
    }
    
    // Check if we can send immediately
    if (this.provider && this.canSend()) {
      debugLog('provider and can send', this.provider, this.canSend());
      try {
        // @ts-expect-error - dynamic dispatch
        this.provider[type](...args, pageContext);
      } catch (error) {
        dispatchError(new AnalyticsError(
          `Error executing ${type}`,
          'PROVIDER_ERROR',
          this.config?.provider,
          error
        ));
      }
      return;
    }
    
    // Determine if we should queue or drop
    const consentStatus = this.consent?.getStatus();
    
    if (consentStatus === 'denied') {
      debugLog('consent denied, dropping event');
      // Drop events when explicitly denied
      this.consent?.incrementDroppedDenied();
      logger.debug(`Event dropped due to consent denial: ${type}`, { args });
      return;
    }
    
    // Queue while pending or provider not ready
    debugLog('Enqueuing')
    const eventId = this.queue.enqueue(
      type,
      args as any,
      pageContext,
    );

    if (eventId) {
      this.consent?.incrementQueued();
      logger.debug(`Event queued: ${type}`, { 
        eventId, 
        queueSize: this.queue.size,
        reason: !this.provider ? 'no provider' : 'consent pending'
      });
      
      // Check for implicit consent promotion on first track
      if (type === 'track' && consentStatus === 'pending') {
        this.consent?.promoteImplicitIfAllowed();
      }
    }
  }
  
  private canSend(): boolean {
    // No consent manager = allow all
    if (!this.consent) return true;
    
    // Check consent status
    return this.consent.isGranted();
  }
  
  private flushAllQueues(): void {
    // First flush SSR queue
    if (!isSSR()) {
      this.flushSSRQueue();
    }
    
    // Then flush facade queue
    this.flushFacadeQueue();
  }
  
  private flushSSRQueue(): void {
    const ssrEvents = hydrateSSRQueue();
    if (ssrEvents.length === 0) return;
    
    logger.info(`Replaying ${ssrEvents.length} SSR events`);
    
    // Check if any SSR events are pageviews for current URL
    if (typeof window !== 'undefined') {
      const currentUrl = window.location.pathname + window.location.search;
      const hasCurrentPageview = ssrEvents.some(
        e => e.type === 'pageview' && 
        (e.args[0] === currentUrl || (!e.args[0] && e.timestamp > Date.now() - 5000))
      );
      
      if (hasCurrentPageview) {
        this.initialPageviewSent = true;
      }
    }
    
    // Replay events
    this.replayEvents(ssrEvents);
  }
  
  private flushFacadeQueue(): void {
    if (this.queue.isEmpty) return;
    
    const events = this.queue.flush();
    logger.info(`Flushing ${events.length} queued facade events`);
    
    this.replayEvents(events);
  }
  
  private replayEvents(events: QueuedEventUnion[]): void {
    if (!this.provider) return;
    
    for (const event of events) {
      try {
        switch (event.type) {
          case 'track': {
            const [name, props, url] = event.args;
            this.provider.track(name, props, url);
            break;
          }
          case 'pageview': {
            const [url] = event.args;
            this.provider.pageview(url);
            break;
          }
          case 'identify': {
            const [userId] = event.args;
            this.provider.identify(userId);
            break;
          }
        }
      } catch (error) {
        dispatchError(new AnalyticsError(
          `Error replaying queued event: ${event.type}`,
          'PROVIDER_ERROR',
          this.config?.provider,
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
  
  // private sendInitialPageview(): void {
  //   debugLog("Preparing to send initial pageview");
  //   if (this.initialPageviewSent || !this.provider) return;
    
  //   const autoTrack = this.config?.autoTrack ?? true;
  //   if (!autoTrack) return;
    
  //   // Check if we're in a browser environment
  //   if (typeof window === 'undefined') return;
    
  //   this.initialPageviewSent = true;
    
  //   // Send the initial pageview
  //   const url = window.location.pathname + window.location.search;
  //   logger.info('Sending initial pageview', { url });
    
  //   // This goes through the provider directly since we already checked consent
  //   debugLog("Sending initial pageview");
  //   this.provider.pageview(url);
  // }

  private sendInitialPageview(): void {
    debugLog("Preparing to send initial pageview");
    if (this.initialPageviewSent || !this.provider) return;
    
    const autoTrack = this.config?.autoTrack ?? true;
    if (!autoTrack) return;
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;
    
    // Send the initial pageview
    const url = window.location.pathname + window.location.search;
    logger.info('Sending initial pageview', { url });
    
    // This goes through the provider directly since we already checked consent
    debugLog("Sending initial pageview");
    this.provider.pageview(url);
    this.initialPageviewSent = true; // Set flag after sending
  }

  // private sendInitialPageview(): void { // UPDATED 1
  //   debugLog('Preparing to send initial pageview');

  //   if (!this.config?.autoTrack) return;
  //   if (!this.provider) return;
  //   if (typeof window === 'undefined') return;

  //   // Gate on consent explicitly
  //   if (this.getConsentState() !== true) {
  //     debugLog('Initial PV suppressed (consent not granted yet)');
  //     return;
  //   }

  //   const url = getPageUrl();
  //   // Idempotent via performSend()’s dedupe
  //   this.provider?.pageview(url);

  //   logger.info('Initial pageview considered', { url, firstSent: this.firstSent });
  // }

  // ================ Navigation Handling ================

  // private normalizeReferrer(ref: string): string {
  //   if (!ref) return '';
  //   try {
  //     const u = new URL(ref, window.location.origin);
  //     if (u.origin === window.location.origin) {
  //       return u.pathname + u.search + u.hash;
  //     }
  //     // different origin: return as-is (or '' if you never want cross-origin)
  //     return ref;
  //   } catch {
  //     // If it's already a relative path, keep it
  //     return ref;
  //   }
  // }

  private normalizeReferrer(ref: string): string {
    if (!ref) return '';
    try {
      const u = new URL(ref, window.location.origin);
      if (u.origin === window.location.origin) {
        // Return just the pathname for same-origin referrers
        return u.pathname + u.search + u.hash;
      }
      // different origin: return as-is
      return ref;
    } catch {
      // If it's already a relative path, keep it
      return ref;
    }
  }

  private buildPageContext(): PageContext {

    // --- Referrer logic ---
    let referrer = '';
    if (!this.firstSent) {
      // First hit uses document.referrer (normalized if same-origin)
      referrer = typeof document !== 'undefined' ? this.normalizeReferrer(document.referrer) : '';
    } else {
      // SPA navigation uses the previously sent URL (same-origin by construction)
      referrer = this.previousUrl ?? '';
    }

    return {
      ...getPageContext(),
      referrer,
    };
  }

  private dispatchPageview = (url: string) => {
    // consent, domains, exclusions — keep your existing guards here
    if (this.lastSentUrl === url) {
      // Deduped: DO NOT update previousUrl/firstSent
      return;
    }

    const pageContext = this.buildPageContext();
    this.provider?.pageview(url, pageContext);

    // Update state only after we successfully send
    this.previousUrl = url;
    this.lastSentUrl = url;
    this.firstSent = true;
  };

  // private maybeStartAutotrack() {
  //   debugLog('maybeStartAutotrack called', this.config?.autoTrack);
  //   if (!this.config?.autoTrack) return;
  //   if (this.navUnsub) return; // idempotent

  //   debugLog('Starting auto-tracking');

  //   // const { isDomainAllowed, isUrlExcluded, getPageUrl } = require('../providers/shared/browser');

  //   const dispatch = (url: string) => {
  //     debugLog('Starting dispatch for URL:', url);
  //     // consent gate
  //     if (this.consent && !this.consent.isGranted()) {
  //       debugLog('Consent not granted, checking status');

  //       const consentStatus = this.consent?.getStatus();
      
  //       if (consentStatus === 'denied') {
  //         debugLog('Consent denied, dropping pageview');
  //         logger.debug(`Url dropped due to consent denial: ${url}`);
  //       } else {
  //         // optionally buffer until grant
  //         // this.consent.onChange((status, prevStatus) => dispatch(url));
  //       }
  //       return;
  //     }
  //     // environment checks
  //     debugLog('Checking if domain allowed')
  //     if (!isDomainAllowed(this.config?.domains)) return;
  //     debugLog('Checking if URL excluded')
  //     if (isUrlExcluded(url, this.config?.exclude)) return;

  //     debugLog('Checking if URL is same as last pageview');
  //     if (this.lastPageviewUrl === url) return; // dedupe
  //     this.lastPageviewUrl = url;

  //     debugLog('Dispatching pageview for URL:', url);
  //     this.dispatchPageview(url);
  //   };

  //   // initial pageview
  //   if (!this.initialPageviewSent) {
  //     const first = getPageUrl();
  //     dispatch(first);
  //     this.initialPageviewSent = true;
  //   }

  //   // subscribe to SPA navigations
  //   const sandbox = ensureNavigationSandbox(window);
  //   this.navUnsub = sandbox.subscribe(dispatch);
  // }

  private maybeStartAutotrack() {
    debugLog('maybeStartAutotrack called', this.config?.autoTrack);
    if (!this.config?.autoTrack) return;
    if (this.navUnsub) return; // idempotent

    debugLog('Starting auto-tracking');

    const dispatch = (url: string) => {
      debugLog('Starting dispatch for URL:', url);
      // consent gate
      if (this.consent && !this.consent.isGranted()) {
        debugLog('Consent not granted, checking status');
        const consentStatus = this.consent?.getStatus();
        
        if (consentStatus === 'denied') {
          debugLog('Consent denied, dropping pageview');
          logger.debug(`Url dropped due to consent denial: ${url}`);
        }
        return false; // Return false to indicate dispatch failed
      }
      
      // environment checks
      debugLog('Checking if domain allowed')
      if (!isDomainAllowed(this.config?.domains)) return false;
      debugLog('Checking if URL excluded')
      if (isUrlExcluded(url, this.config?.exclude)) return false;

      debugLog('Checking if URL is same as last pageview');
      if (this.lastPageviewUrl === url) return false; // dedupe
      this.lastPageviewUrl = url;

      debugLog('Dispatching pageview for URL:', url);
      this.dispatchPageview(url);
      return true; // Return true to indicate dispatch succeeded
    };

    // initial pageview
    if (!this.initialPageviewSent) {
      const first = getPageUrl();
      const sent = dispatch(first);
      if (sent) {
        this.initialPageviewSent = true;
      }
    }

    // subscribe to SPA navigations
    const sandbox = ensureNavigationSandbox(window);
    this.navUnsub = sandbox.subscribe(dispatch);
  }

    // private maybeStartAutotrack() { // UPDATED
  //   debugLog('maybeStartAutotrack called', this.config?.autoTrack);
  //   if (!this.config?.autoTrack) return;
  //   if (this.navUnsub) return; // idempotent
  //   if (typeof window === 'undefined') return;

  //   debugLog('Starting auto-tracking');

  //   // Send initial *if consent is granted now*; otherwise arm a one-shot in setupConsentCallbacks()
  //   if (this.getConsentState() === true && !this.firstSent) {
  //     const first = getPageUrl();
  //     // this.performSend(first);
  //     this.provider?.pageview(first);
  //   }

  //   // Subscribe to SPA navigations (history sandbox)
  //   const sandbox = ensureNavigationSandbox(window);
  //   this.navUnsub = sandbox.subscribe((url: string) => {
  //     debugLog('Autotrack dispatch for URL:', url);

  //     // Consent gate for SPA hits
  //     if (this.getConsentState() !== true) {
  //       debugLog('Consent not granted; dropping SPA pageview', { url });
  //       return;
  //     }

  //     this.provider?.pageview(url);
  //   });
  // }

  private stopAutotrack() {
    this.navUnsub?.();
    this.navUnsub = null;
    this.lastPageviewUrl = null;
    this.initialPageviewSent = false;
  }

  // ================ Error Handling ================
  
  private handleInitError(error: unknown): void {
    const analyticsError = error instanceof AnalyticsError ? error :
      new AnalyticsError(
        String(error),
        'INIT_FAILED',
        this.config?.provider,
        error
      );
    
    dispatchError(analyticsError);
  }
  
  private async handleInitFailure(error: unknown, config: AnalyticsOptions): Promise<void> {
    const wrapped = error instanceof AnalyticsError ? error :
      new AnalyticsError(
        'Failed to initialize analytics',
        'INIT_FAILED',
        config.provider,
        error
      );
    
    dispatchError(wrapped);
    logger.error('Initialization failed – falling back to noop', wrapped);
    
    // Try to load noop provider
    try {
      const provider = await loadProviderAsync({
        ...config,
        provider: 'noop',
      });
      
      this.provider = provider;

      const consentConfig = getConsentConfig(config);
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
    
    // Set minimal config
    this.config = {
      provider: 'noop',
      queueSize: 50,
      debug: this.config?.debug ?? false,
    };
    
    // Start loading noop
    this.initPromise = this.handleInitFailure(error, this.config)
      .finally(() => {
        this.initPromise = null;
      });
  }
  
  private handleQueueOverflow(dropped: QueuedEventUnion[]): void {
    const error = new AnalyticsError(
      `Queue overflow: ${dropped.length} events dropped`,
      'QUEUE_OVERFLOW',
      this.config?.provider
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
  
  private reconfigureQueue(config: AnalyticsOptions): void {
    this.queue = new EventQueue({
      maxSize: config.queueSize || 50,
      debug: config.debug,
      onOverflow: (dropped) => {
        this.handleQueueOverflow(dropped);
      },
    });
  }
  
  private optionsDifferMeaningfully(next: AnalyticsOptions): boolean {
    if (!this.config) return false;
    
    const keys: (keyof AnalyticsOptions)[] = [
      'provider', 'siteId', 'host', 'queueSize'
    ];
    
    return keys.some(k => 
      next[k] !== undefined && next[k] !== this.config![k]
    );
  }

  // private getConsentState(): boolean | null {
  //   const cm = this.consent;          // this.consent may be undefined
  //   if (!cm) return null;             // treat “no manager yet” as null, not undefined
  //   const v = cm.isGranted?.();       // if you typed as method; if it's a boolean property, use cm.isGranted
  //   return typeof v === 'boolean' ? v : (v === null ? null : null);
  // }

  private getConsentState(): boolean | null {
    const cm = this.consent;
    if (!cm) return null;
    
    // Make sure isGranted is a method and returns a boolean
    const granted = cm.isGranted();
    return granted;
  }

  // ================ Setters & Getters for Testing ================
  
  setProvider(provider: StatefulProvider): void {
    this.provider = provider;
    this.setupProviderCallbacks();
    this.setupConsentCallbacks();
    this.maybeStartAutotrack();
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
    if (this.provider && this.consent?.isGranted() && this.hasQueuedEvents()) {
      this.flushAllQueues();
    }
  }
}