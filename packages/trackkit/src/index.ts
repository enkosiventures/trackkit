/* ──────────────────────────────────────────────────────────────────────────
 *  TrackKit – public entrypoint (singleton facade + permanent proxy)
 * ───────────────────────────────────────────────────────────────────────── */

import type {
  AnalyticsInstance,
  AnalyticsOptions,
  ConsentState,
  Props,
  ProviderType,
} from './types';

import { AnalyticsError, isAnalyticsError } from './errors';
import { parseEnvBoolean, parseEnvNumber, readEnvConfig } from './util/env';
import { createLogger, setGlobalLogger, logger } from './util/logger';
import { ConsentManager } from './consent/ConsentManager';
import { loadProvider }           from './provider-loader';
import {
  isSSR,
  getSSRQueue,
  hydrateSSRQueue,
  clearSSRQueue,
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
    consentMgr      = new ConsentManager(config.consent ?? {});
    onError         = config.onError;

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
    // if (!realInstance) return;
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
    this.queue.length = 0;
    // this.clearProxyQueue();
    logger.info('Analytics destroyed');
  }

  track      = (...a: Parameters<AnalyticsInstance['track']>)      => this.exec('track',      a);
  pageview   = (...a: Parameters<AnalyticsInstance['pageview']>)   => this.exec('pageview',   a);
  identify   = (...a: Parameters<AnalyticsInstance['identify']>)   => this.exec('identify',   a);
  setConsent = (...a: Parameters<AnalyticsInstance['setConsent']>) => this.exec('setConsent', a);

  /* ---------- Diagnostics for tests/devtools ---------- */

  waitForReady = async (): Promise<AnalyticsInstance> => {
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

  getQueueLength() {
    return this.queue.length + (isSSR() ? getSSRQueue().length : 0);
  }

  flushProxyQueue() {
    // Drain SSR queue (browser hydrate)
    if (!isSSR()) {
      const ssrEvents = hydrateSSRQueue();
      if (ssrEvents.length > 0) {
        logger.info(`Replaying ${ssrEvents.length} SSR events`);
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

  clearProxyQueue() {
    // Clear SSR queue
    if (isSSR()) {
      clearSSRQueue();
    }

    // Clear local queue
    if (this.queue.length > 0) {
      logger.warn(`Clearing ${this.queue.length} queued pre-init events`);
      this.queue.length = 0;
    }
  }

  /* ---------- Internal helpers ---------- */

  private exec(type: keyof AnalyticsInstance, args: unknown[]) {
    /* ---------- live instance ready ---------- */
    if (realInstance) {
      if (this.canSend(type, args)) {
        // eslint‑disable-next‑line @typescript-eslint/ban-ts-comment
        // @ts-expect-error dynamic dispatch
        realInstance[type](...args);
      } else {
        // consentMgr?.incrementQueued();
        // this.enqueue(type, args);

        // If consent is denied, increment dropped counter
        if (consentMgr?.getStatus() === 'denied' && type !== 'setConsent') {
          consentMgr.incrementDroppedDenied();
          return; // Don't queue when denied
        }
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
    if (consentMgr?.getStatus() === 'denied' && type !== 'setConsent') {
      consentMgr.incrementDroppedDenied();
      return;
    }

    consentMgr?.incrementQueued();
    consentMgr?.promoteImplicitIfAllowed();
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
    if (type === 'setConsent') return true;      // always allow
    const category =
      type === 'track' && args.length > 3 ? (args[3] as any) : undefined;
    return consentMgr.isGranted(category);
  }

  private async loadAsync(cfg: AnalyticsOptions) {
    const provider = await loadProvider(
      cfg.provider as ProviderType,
      cfg,
      () => {
        if (consentMgr?.getStatus() === 'granted' && this.getQueueLength() > 0) {
          this.flushProxyQueue();
        }
      }
    );
    realInstance = provider;

    // Subscribe to consent changes
    consentMgr?.onChange((status, prev) => {
      logger.info('Consent changed', { from: prev, to: status });
      
      if (status === 'granted' && realInstance && this.queue.length > 0) {
        // Flush queued events
        this.flushProxyQueue();
      } else if (status === 'denied') {
        // Clear queue
        this.queue.length = 0;
        logger.info('Consent denied - cleared event queue');
      }
    });

    logger.info('Analytics initialized successfully', {
      provider: cfg.provider,
      consent: consentMgr?.getStatus(),
    });
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
export const setConsent = (s: ConsentState)          => analyticsFacade.setConsent(s);

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
  if (realInstance && analyticsFacade.getQueueLength() > 0) {
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
  analyticsFacade.clearProxyQueue();
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