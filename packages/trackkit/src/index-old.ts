/* ──────────────────────────────────────────────────────────────────────────
 *  TrackKit – public entrypoint (singleton facade + permanent proxy)
 * ───────────────────────────────────────────────────────────────────────── */

import type {
  AnalyticsInstance,
  AnalyticsOptions,
  Props,
  ProviderType,
} from './types';

import { AnalyticsError, isAnalyticsError } from './errors';
import { parseEnvBoolean, parseEnvNumber, readEnvConfig } from './util/env';
import { createLogger, setGlobalLogger, logger } from './util/logger';
import { ConsentManager } from './consent/ConsentManager';
import { loadProvider }           from './providers/loader';
import { getProviderMetadata } from './providers/metadata';
import {
  isSSR,
  getSSRQueue,
  getSSRQueueLength,
  hydrateSSRQueue,
} from './util/ssr-queue';
import { QueuedEventUnion } from './util/queue';
import { StatefulProvider } from './providers/stateful-wrapper';
import { ConsentSnapshot, ConsentStatus } from './consent/types';

/* ------------------------------------------------------------------ */
/*  Defaults & module‑level state                                     */
/* ------------------------------------------------------------------ */

const DEFAULT_OPTS: Required<
  Pick<AnalyticsOptions,
    'provider' | 'queueSize' | 'debug' | 'batchSize' | 'batchTimeout'
  >
> = {
  provider:     'noop',
  queueSize:    50,
  debug:        false,
  batchSize:    10,
  batchTimeout: 1000,
};

let realInstance: StatefulProvider | null = null;  // becomes StatefulProvider
let initPromise : Promise<void> | null     = null;  // first async load in‑flight
let activeConfig: AnalyticsOptions | null  = null;
let consentMgr: ConsentManager | null = null;
let onError: ((e: AnalyticsError) => void) | undefined;    // current error handler

/* ------------------------------------------------------------------ */
/* Utility: centralised safe error dispatch                           */
/* ------------------------------------------------------------------ */

function dispatchError(err: unknown) {
  const analyticsErr: AnalyticsError =
    isAnalyticsError(err)
      ? err
      : new AnalyticsError(
          (err as any)?.message || 'Unknown analytics error',
          'PROVIDER_ERROR',
          (err as any)?.provider
        );

  try {
    onError?.(analyticsErr);
  } catch (userHandlerError) {
    // Swallow user callback exceptions; surface both
    logger.error(
      'Error in error handler',
      analyticsErr,
      userHandlerError instanceof Error
        ? userHandlerError
        : String(userHandlerError)
    );
  }
}

/* ------------------------------------------------------------------ */
/* Validation (fast fail before async work)                           */
/* ------------------------------------------------------------------ */
const VALID_PROVIDERS: ProviderType[] = ['noop', 'umami' /* future: plausible, ga */];

function validateConfig(cfg: AnalyticsOptions) {
  if (!VALID_PROVIDERS.includes(cfg.provider as ProviderType)) {
    throw new AnalyticsError(
      `Unknown provider: ${cfg.provider}`,
      'INVALID_CONFIG',
      cfg.provider
    );
  }
  if (cfg.queueSize != null && cfg.queueSize < 1) {
    throw new AnalyticsError(
      'Queue size must be at least 1',
      'INVALID_CONFIG',
      cfg.provider
    );
  }
  if (!cfg.provider) {
    throw new AnalyticsError(
      'Provider must be specified (or resolved from env)',
      'INVALID_CONFIG'
    );
  }
  // Provider‑specific light checks (extend later)
  if (cfg.provider === 'umami') {
    if (!cfg.siteId) {
      throw new AnalyticsError(
        'Umami provider requires a siteId (website UUID)',
        'INVALID_CONFIG',
        'umami'
      );
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Permanent proxy – never replaced                                   */
/* ------------------------------------------------------------------ */

type QueuedCall = {
  type: keyof AnalyticsInstance;
  args: unknown[];
  timestamp: number;
  category?: string;
};

class AnalyticsFacade implements AnalyticsInstance {
  readonly name = 'analytics-facade';

  private queue: QueuedCall[] = [];
  private queueLimit = DEFAULT_OPTS.queueSize;

  // Add flag to track if initial pageview has been sent
  initialPageviewSent = false;

  /* public API – always safe to call -------------------------------- */

  init(cfg: AnalyticsOptions = {}) {
    // already have a real provider
    if (realInstance)        return this;
    
    // someone else is loading; keep queuing
    if (initPromise)         return this;


    // Already loading – warn if materially different
    if (initPromise) {
      if (this.optionsDifferMeaningfully(cfg)) {
        logger.warn(
          'init() called with different options while initialization in progress; ignoring new options'
        );
      }
      return this;
    }

    // Merge env + defaults + cfg
    const envConfig = readEnvConfig();
    const default_options: Partial<AnalyticsOptions> = {
        provider: (envConfig.provider ?? DEFAULT_OPTS.provider) as ProviderType,
        siteId: envConfig.siteId,
        host: envConfig.host,
        queueSize: parseEnvNumber(envConfig.queueSize, DEFAULT_OPTS.queueSize),
        debug: parseEnvBoolean(envConfig.debug, DEFAULT_OPTS.debug),
        batchSize: DEFAULT_OPTS.batchSize,
        batchTimeout: DEFAULT_OPTS.batchTimeout,
    };
    const config: AnalyticsOptions = { ...default_options, ...cfg };
    this.queueLimit = config.queueSize ?? DEFAULT_OPTS.queueSize;
    activeConfig    = config;
    onError         = config.onError;

    // Consent manager setup
    const providerMeta = getProviderMetadata(config.provider as string);
    const consentConfig = {
      // Provider defaults (if available)
      ...providerMeta?.consentDefaults,
      
      // User overrides
      ...config.consent,
    };
    logger.info('Consent configuration', {
      provider: config.provider,
      providerDefaults: providerMeta?.consentDefaults,
      userConfig: config.consent,
      finalConfig: consentConfig,
    });
    consentMgr = new ConsentManager(consentConfig);

    // Logger first (so we can log validation issues)
    setGlobalLogger(createLogger(!!config.debug));

    // Validate synchronously
    try {
      validateConfig(config);
    } catch (e) {
      const err = e instanceof AnalyticsError
        ? e
        : new AnalyticsError(String(e), 'INVALID_CONFIG', config.provider, e);
      dispatchError(err);
      // Fallback: attempt noop init so API stays usable
      return this.startFallbackNoop(err);
    }

    logger.info('Initializing analytics', {
      provider: config.provider,
      queueSize: config.queueSize,
      debug: config.debug,
    });

    initPromise = this.loadAsync(config)
      .catch(async (loadErr) => {
        const wrapped = loadErr instanceof AnalyticsError
          ? loadErr
          : new AnalyticsError(
              'Failed to initialize analytics',
              'INIT_FAILED',
              config.provider,
              loadErr
            );
        dispatchError(wrapped);
        logger.error('Initialization failed – falling back to noop', wrapped);
        await this.loadFallbackNoop(config);
      })
      .finally(() => { initPromise = null; });

    return this;
  }

  destroy(): void {
    try {
      realInstance?.destroy();
    } catch (e) {
      const err = new AnalyticsError(
        'Provider destroy failed',
        'PROVIDER_ERROR',
        activeConfig?.provider,
        e
      );
      dispatchError(err);
      logger.error('Destroy error', err);
    }
    onError = undefined;
    realInstance = null;
    activeConfig = null;
    initPromise = null;
    consentMgr = null;
    this.clearAllQueues();
    this.initialPageviewSent = false;
    logger.info('Analytics destroyed');
  }

  track      = (...a: Parameters<AnalyticsInstance['track']>)      => this.exec('track',      a);
  pageview   = (...a: Parameters<AnalyticsInstance['pageview']>)   => this.exec('pageview',   a);
  identify   = (...a: Parameters<AnalyticsInstance['identify']>)   => this.exec('identify',   a);

  /* ---------- Diagnostics for tests/devtools ---------- */

  waitForReady = async (): Promise<StatefulProvider> => {
    if (realInstance) return realInstance;
    if (initPromise) await initPromise;
    if (!realInstance) {
      throw new AnalyticsError(
        'Analytics not initialized',
        'INIT_FAILED',
        activeConfig?.provider
      );
    }
    return realInstance;
  };

  get instance() { return realInstance; }
  get config()      { return activeConfig ? { ...activeConfig } : null; }
  getDiagnostics() {
    return {
      hasRealInstance: !!realInstance,
      queueSize: this.queue.length,
      queueLimit: this.queueLimit,
      initializing: !!initPromise,
      provider: activeConfig?.provider ?? null,
      debug: !!activeConfig?.debug,
    };
  }

  /**
   * Get total queued events (facade + SSR)
   */
  private getQueueLength(): number {
    const facadeQueue = this.queue.length;
    const ssrQueue = !isSSR() ? getSSRQueueLength() : 0;
    return facadeQueue + ssrQueue;
  }
  
  /**
   * Check if any events are queued
   */
  hasQueuedEvents(): boolean {
    return this.getQueueLength() > 0;
  }
  
  /**
   * Clear all queues
   */
  private clearAllQueues(): void {
    this.queue.length = 0;
    if (!isSSR()) {
      hydrateSSRQueue(); // This clears the SSR queue
    }
  }
  
  /**
   * Clear only facade queue (e.g., on consent denial)
   */
  clearFacadeQueue(): void {
    this.queue.length = 0;
  }

  flushProxyQueue(): void {
    // Drain SSR queue (browser hydrate)
    if (!isSSR()) {
      const ssrEvents = hydrateSSRQueue();
      if (ssrEvents.length > 0) {
        logger.info(`Replaying ${ssrEvents.length} SSR events`);

        // Check if any SSR events are pageviews for current URL
        const currentUrl = window.location.pathname + window.location.search;
        const hasCurrentPageview = ssrEvents.some(
          e => e.type === 'pageview' && 
          (e.args[0] === currentUrl || (!e.args[0] && e.timestamp > Date.now() - 5000))
        );
        
        if (hasCurrentPageview) {
          this.initialPageviewSent = true;
        }
        
        this.replayEvents(ssrEvents.map(e => ({ type: e.type, args: e.args })));
      }
    }

    // Flush pre-init local queue
    if (this.queue.length > 0) {
      logger.info(`Flushing ${this.queue.length} queued pre-init events`);
      this.replayEvents(this.queue);
      this.queue.length = 0;
    }
  }

  /* ---------- Internal helpers ---------- */

  private exec(type: keyof AnalyticsInstance, args: unknown[]) {
    /* ---------- live instance ready ---------- */
    logger.info(`Executing ${type} with args`, args); // DEBUG
    // consentMgr?.promoteImplicitIfAllowed();
    if (realInstance) {
      logger.debug('Real instance available');

      if (this.canSend(type, args)) {
        logger.debug(`Sending ${type} with args`, args); // DEBUG
        // eslint‑disable-next‑line @typescript-eslint/ban-ts-comment
        // @ts-expect-error dynamic dispatch
        realInstance[type](...args);
      } else {
        logger.warn(`Can't send ${type}`);
        // If consent is pending, increment
        // consentMgr?.incrementQueued();
        // this.enqueue(type, args);

        // If consent is denied, increment dropped counter
        if (consentMgr?.getStatus() === 'denied') {
          logger.warn(`Consent denied for ${type} – not queuing`);
          consentMgr.incrementDroppedDenied();
          return; // Don't queue when denied
        }
        logger.warn(`Consent pending for ${type} – queuing`);
        consentMgr?.promoteImplicitIfAllowed();
        consentMgr?.incrementQueued();
        this.enqueue(type, args);
      }
      return;
    }

    /* ---------- no real instance yet ---------- */
    if (isSSR()) {
      getSSRQueue().push({
        id: `ssr_${Date.now()}_${Math.random()}`,
        type,
        timestamp: Date.now(),
        args,
      } as QueuedEventUnion);
      return;
    }

    // Check if denied before queuing
    if (consentMgr?.getStatus() === 'denied') {
      consentMgr.incrementDroppedDenied();
      return;
    }

    consentMgr?.incrementQueued();
    this.enqueue(type, args);
  }

  /** tiny helper to DRY queue‑overflow logic */
  private enqueue(type: keyof AnalyticsInstance, args: unknown[]) {
    if (this.queue.length >= this.queueLimit) {
      const dropped = this.queue.shift();
      dispatchError(new AnalyticsError('Queue overflow', 'QUEUE_OVERFLOW'));
      logger.warn('Queue overflow – oldest dropped', { droppedMethod: dropped?.type });
    }
    this.queue.push({ type, args, timestamp: Date.now() });
  }

  /** single place to decide “can we send right now?” */
  private canSend(type: keyof AnalyticsInstance, args: unknown[]) {
    if (!consentMgr) return true;                // no CMP installed
    const category =
      type === 'track' && args.length > 3 ? (args[3] as any) : undefined;
    return consentMgr.isGranted(category);
  }

  private async loadAsync(cfg: AnalyticsOptions) {
    const provider = await loadProvider(
      cfg.provider as ProviderType,
      cfg,
      // (provider) => {
      //   if (consentMgr?.getStatus() === 'granted' && this.getQueueLength() > 0) {
      //     realInstance = provider || null;
      //     this.flushProxyQueue();
      //   }
      // }
    );

    realInstance = provider;

    // Register ready callback
    provider.onReady(() => {
      logger.info('Provider ready, checking for consent and queued events');
      
      // Check if we should flush queue
      if (consentMgr?.getStatus() === 'granted' && this.hasQueuedEvents()) {
        this.flushProxyQueue();
        this.sendInitialPageview();
      }
    });

    // Set up navigation callback (if supported)
    provider.setNavigationCallback((url: string) => {
      // Route navigation pageviews through facade for consent check
      this.pageview(url);
    });

    // Subscribe to consent changes
    consentMgr?.onChange((status, prev) => {
      logger.info('Consent changed', { from: prev, to: status });
      
      if (status === 'granted' && realInstance) {
        // Check if provider is ready
        const providerState = (realInstance as any).state?.getState();
        if (providerState === 'ready') {
          if (this.hasQueuedEvents()) {
            this.flushProxyQueue();
          }
          this.sendInitialPageview();
        }
        // If not ready, the onReady callback will handle it
      } else if (status === 'denied') {
        this.clearFacadeQueue();
        logger.info('Consent denied - cleared facade event queue');
      }
    });

    logger.info('Analytics initialized successfully', {
      provider: cfg.provider,
      consent: consentMgr?.getStatus(),
    });
  }

  private sendInitialPageview() {
    console.warn("Sending initial pageview if not already sent")
    if (this.initialPageviewSent || !realInstance) return;
    console.warn('Not already sent');
    
    const autoTrack = activeConfig?.autoTrack ?? true;
    if (!autoTrack) return;
    console.warn('Auto track enabled');
  
    // Check if we're in a browser environment
    if (typeof window === 'undefined') return;
    console.warn('In browser environment');
  
    this.initialPageviewSent = true;
    
    // Send the initial pageview
    const url = window.location.pathname + window.location.search;
    logger.info('Sending initial pageview', { url });
    
    // This will go through normal consent checks
    this.pageview(url);
  }

  private async loadFallbackNoop(baseCfg: AnalyticsOptions) {
    try {
      await this.loadAsync({ ...baseCfg, provider: 'noop' });
    } catch (noopErr) {
      const err = new AnalyticsError(
        'Failed to load fallback provider',
        'INIT_FAILED',
        'noop',
        noopErr
      );
      dispatchError(err);
      logger.error('Fatal: fallback noop load failed', err);
    }
  }

  private startFallbackNoop(validationErr: AnalyticsError) {
    logger.warn('Invalid config – falling back to noop', validationErr.toJSON?.());

    // Ensure logger is at least minimally configured
    if (!activeConfig) { setGlobalLogger(createLogger(false)); }

    // Set active config explicitly
    activeConfig = {
      ...DEFAULT_OPTS,
      provider: 'noop',
      debug: activeConfig?.debug ?? false,
    };

    // Begin loading noop (async) provider to allow continued queuing
    initPromise = this.loadFallbackNoop(activeConfig)
      .finally(() => { initPromise = null; });

    return this;
  }


  private replayEvents(events: { type: keyof AnalyticsInstance; args: unknown[] }[]) {
    for (const evt of events) {
      try {
        // @ts-expect-error dynamic dispatch
        realInstance![evt.type](...evt.args);
      } catch (e) {
        const err = new AnalyticsError(
          `Error replaying queued event: ${String(evt.type)}`,
          'PROVIDER_ERROR',
          activeConfig?.provider,
          e
        );
        dispatchError(err);
        logger.error('Replay failure', { method: evt.type, error: err });
      }
    }
  }

  private optionsDifferMeaningfully(next: AnalyticsOptions) {
    if (!activeConfig) return false;
    const keys: (keyof AnalyticsOptions)[] = [
      'provider', 'siteId', 'host', 'queueSize'
    ];
    return keys.some(k => next[k] !== undefined && next[k] !== activeConfig![k]);
  }
}

/* ------------------------------------------------------------------ */
/* Singleton Facade & Public Surface                                  */
/* ------------------------------------------------------------------ */

export const analyticsFacade = new AnalyticsFacade();

/* Public helpers (stable API) */
export const init       = (o: AnalyticsOptions = {}) => analyticsFacade.init(o);
export const destroy    = ()                         => analyticsFacade.destroy();
export const track      = (n: string, p?: Props, u?: string) =>
analyticsFacade.track(n, p, u);
export const pageview   = (u?: string)               => analyticsFacade.pageview(u);
export const identify   = (id: string | null)        => analyticsFacade.identify(id);

/* Introspection (non‑breaking extras) */
export const waitForReady  = () => analyticsFacade.waitForReady();
export const getInstance   = () => analyticsFacade.instance;
export const getDiagnostics = () => analyticsFacade.getDiagnostics();
export const getConsentManager = () => consentMgr;  // temp diagnostic helper

/* Consent Management API */
export function getConsent(): ConsentSnapshot | null {
  return consentMgr?.snapshot() || null;
}

export function grantConsent(): void {
  if (!consentMgr) {
    logger.warn('Analytics not initialized - cannot grant consent');
    return;
  }
  consentMgr.grant();
  
  // Flush queue if provider is ready
  if (realInstance && !analyticsFacade.hasQueuedEvents()) {
    logger.warn('Granting consent with real instance - flushing proxy queue');
    analyticsFacade.flushProxyQueue();
  }
}

export function denyConsent(): void {
  if (!consentMgr) {
    logger.warn('Analytics not initialized - cannot deny consent');
    return;
  }
  consentMgr.deny();
  
  // Clear facade queue on denial
  analyticsFacade.clearFacadeQueue();
}

export function resetConsent(): void {
  if (!consentMgr) {
    logger.warn('Analytics not initialized - cannot reset consent');
    return;
  }
  consentMgr.reset();
}

export function onConsentChange(callback: (status: ConsentStatus, prev: ConsentStatus) => void): () => void {
  if (!consentMgr) {
    logger.warn('Analytics not initialized - cannot subscribe to consent changes');
    return () => {};
  }
  return consentMgr.onChange(callback);
}