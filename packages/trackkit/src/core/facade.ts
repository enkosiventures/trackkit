import type { AnalyticsInstance, AnalyticsOptions, Props } from '../types';
import { AnalyticsError } from '../errors';
import { createLogger, logger, setGlobalLogger } from '../util/logger';
import { EventQueue, QueuedEvent, QueuedEventUnion } from '../util/queue';
import { validateConfig, mergeConfig, getConsentConfig } from './config';
import { loadProviderAsync } from './initialization';
import { isSSR, hydrateSSRQueue, getSSRQueue, getSSRQueueLength } from '../util/ssr-queue';
import { ConsentManager } from '../consent/ConsentManager';
import type { StatefulProvider } from '../providers/stateful-wrapper';
import { config } from 'node:process';


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
  
  // Tracking state
  private initialPageviewSent = false;
  private errorHandler: ((e: AnalyticsError) => void) | undefined;
  
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
      this.errorHandler = config.onError;

      validateConfig(config);

      // Update queue with final config
      this.reconfigureQueue(config);

      // Create consent manager synchronously
      const consentConfig = getConsentConfig(config);
      this.consent = new ConsentManager(consentConfig);

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
      this.dispatchError(new AnalyticsError(
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
    this.errorHandler = undefined;
    this.initialPageviewSent = false;
    
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
    
    // Provider ready callback
    this.provider.onReady(() => {
      logger.info('Provider ready, checking for consent and queued events');
      
      // Flush queues if consent granted
      if (this.consent?.isGranted()) {
        this.flushAllQueues();
        this.sendInitialPageview();
      }
    });
    
    // Navigation callback for SPA tracking
    this.provider.setNavigationCallback?.((url: string) => {
      // Route navigation pageviews through facade for consent check
      this.pageview(url);
    });
  }

  private setupConsentCallbacks(): void {
    if (!this.consent) return;
    
    this.consent.onChange((status, prevStatus) => {
      logger.info('Consent changed', { from: prevStatus, to: status });
      
      if (status === 'granted' && this.provider) {
        // Check if provider is ready
        const providerReady = (this.provider as any).state?.getState() === 'ready';
        
        if (providerReady) {
          // Flush queued events
          if (this.getTotalQueueSize() > 0) {
            this.flushAllQueues();
          }
          // Send initial pageview if not sent
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
  
  private execute(type: keyof AnalyticsInstance, args: unknown[]): void {
    // SSR: always queue
    if (isSSR()) {
      getSSRQueue().push({
        id: `ssr_${Date.now()}_${Math.random()}`,
        type: type as any,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
      return;
    }
    
    // Check if we can send immediately
    if (this.provider && this.canSend(type)) {
      try {
        // @ts-expect-error - dynamic dispatch
        this.provider[type](...args);
      } catch (error) {
        this.dispatchError(new AnalyticsError(
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
      // Drop events when explicitly denied
      this.consent?.incrementDroppedDenied();
      logger.debug(`Event dropped due to consent denial: ${type}`, { args });
      return;
    }
    
    // Queue while pending or provider not ready
    const eventId = this.queue.enqueue(type as any, args as any);
    
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
  
  private canSend(type: keyof AnalyticsInstance): boolean {
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
        this.dispatchError(new AnalyticsError(
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
  
  private sendInitialPageview(): void {
    if (this.initialPageviewSent || !this.provider) return;
    
    const autoTrack = this.config?.autoTrack ?? true;
    if (!autoTrack) return;
    
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;
    
    this.initialPageviewSent = true;
    
    // Send the initial pageview
    const url = window.location.pathname + window.location.search;
    logger.info('Sending initial pageview', { url });
    
    // This goes through the provider directly since we already checked consent
    this.provider.pageview(url);
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
    
    this.dispatchError(analyticsError);
  }
  
  private async handleInitFailure(error: unknown, config: AnalyticsOptions): Promise<void> {
    const wrapped = error instanceof AnalyticsError ? error :
      new AnalyticsError(
        'Failed to initialize analytics',
        'INIT_FAILED',
        config.provider,
        error
      );
    
    this.dispatchError(wrapped);
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
      this.dispatchError(fatalError);
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
  
  private dispatchError(error: AnalyticsError): void {
    try {
      this.errorHandler?.(error);
    } catch (userHandlerError) {
      // Swallow user callback exceptions
      logger.error(
        'Error in error handler',
        error,
        userHandlerError instanceof Error ? userHandlerError : String(userHandlerError)
      );
    }
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
    
    this.dispatchError(error);
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

  // ================ Getters for Testing ================
  
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