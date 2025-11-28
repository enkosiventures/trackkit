import type { ProviderType, ResolvedFacadeOptions } from '../types';
import { type QueueService, getSSRQueueLength } from '../queues';
import type { ContextService } from './context';
import type { ProviderManager } from './provider-manager';
import type { ConsentStatus, ConsentStoredState } from '../consent/types';
import type { ProviderState } from '../providers/types';
import type { ProviderStateHistory } from '../util/state';
import type { PerformanceTracker } from '../performance/tracker';
import { ResolvedBatchingOptions, ResolvedDispatcherOptions } from '../dispatcher/types';

export interface ProviderStateSnapshot {
  provider: string | null;
  state: ProviderState | 'unknown';
  details?: unknown;
}

export interface DiagnosticsSnapshot {
  timestamp: number;
  instanceId: string;
  config: {
    debug: boolean;
    queueSize: number;
    autoTrack: boolean;
    doNotTrack: boolean;
    trackLocalhost: boolean;
    includeHash: boolean;
    domains: string[];
  };
  consent: {
    status?: ConsentStatus;
    version?: string;
    method?: string;
  };
  dispatcher: {
    batching: ResolvedBatchingOptions;
    resilience: {
      detectBlockers: boolean;
      fallbackStrategy: 'proxy' | 'beacon' | 'none';
      hasProxy: boolean;
      retry: {
        maxAttempts: number;
        initialDelay: number;
        maxDelay: number;
      };
    };
    connection: {
      monitor: boolean;
      offlineStorage: boolean;
      slowThreshold: number;
    };
  };
  performance?: {
    enabled: boolean;
    sampleRate: number;
    initTime: number;
    avgProcessingTime: number;
    avgNetworkLatency: number;
    totalEvents: number;
    failedEvents: number;
  };
  provider: {
    key: string | null;
    state: ProviderState;
    history: ProviderStateHistory;
  };
  queue: {
    totalBuffered: number;   // SSR + facade
    ssrQueueBuffered: number;
    facadeQueueBuffered: number;
    capacity: number;
  };
  urls: {
    lastPlanned: string | null;
    lastSent: string | null;
  };
}

/**
 * DiagnosticsService produces a point-in-time snapshot of the facade state.
 *
 * It is intentionally read-only and side-effect free:
 * - config: selected runtime options relevant to behaviour and debugging
 * - consent: stored consent status + metadata (if any)
 * - dispatcher: key dispatcher settings affecting delivery
 * - performance: current performance metrics (if enabled)
 * - provider: current provider key + provider-reported state/history
 * - queue: combined SSR + runtime buffer size and capacity
 * - urls: last planned and last sent URLs from the context service
 *
 * Used by `getDiagnostics()` on the facade to support debugging and health checks.
 */
export class DiagnosticsService {
  constructor(
    private id: string,
    private facade: ResolvedFacadeOptions,
    private dispatcher: ResolvedDispatcherOptions,
    private consent: {
      snapshot(): ConsentStoredState | undefined;
    },
    private queues: QueueService,
    private ctx: ContextService,
    private provider: ProviderManager,
    private providerKey: ProviderType,
    private performanceTracker: PerformanceTracker | null,
  ) {}

  getSnapshot(): DiagnosticsSnapshot {
    const capacity = this.facade.queueSize;

    const provider = this.provider.get();
    const providerSnapshot =
      provider && typeof (provider as any).getSnapshot === 'function'
        ? (provider as any).getSnapshot()
        : { state: 'unknown' as ProviderState, history: [] as ProviderStateHistory };

    return {
      timestamp: Date.now(),
      instanceId: this.id,
      config: {
        debug: this.facade.debug,
        queueSize: this.facade.queueSize,
        autoTrack: this.facade.autoTrack,
        doNotTrack: this.facade.doNotTrack,
        trackLocalhost: this.facade.trackLocalhost,
        includeHash: this.facade.includeHash,
        domains: this.facade.domains,
      },
      consent: {
        ...this.consent.snapshot(),
      },
      dispatcher: {
        batching: this.dispatcher.batching,
        connection: {
          monitor: this.dispatcher.connection.monitor,
          offlineStorage: this.dispatcher.connection.offlineStorage,
          slowThreshold: this.dispatcher.connection.slowThreshold,
        },
        resilience: {
          detectBlockers: this.dispatcher.resilience.detectBlockers,
          fallbackStrategy: this.dispatcher.resilience.fallbackStrategy,
          hasProxy: !!this.dispatcher.resilience.proxy?.proxyUrl,
          retry: {
            maxAttempts: this.dispatcher.resilience.retry.maxAttempts,
            initialDelay: this.dispatcher.resilience.retry.initialDelay,
            maxDelay: this.dispatcher.resilience.retry.maxDelay,
          },
        },
      },
      performance: this.performanceTracker
        ? {
            enabled: this.dispatcher.performance.enabled,
            sampleRate: this.dispatcher.performance.sampleRate,
            initTime: this.performanceTracker.metrics.initTime,
            avgProcessingTime: this.performanceTracker.metrics.avgProcessingTime,
            avgNetworkLatency: this.performanceTracker.metrics.avgNetworkLatency,
            totalEvents: this.performanceTracker.metrics.totalEvents,
            failedEvents: this.performanceTracker.metrics.failedEvents,
          }
        : undefined,
      provider: {
        key: this.providerKey,
        ...providerSnapshot,
      },
      queue: {
        totalBuffered: this.queues.size() + getSSRQueueLength(),
        ssrQueueBuffered: getSSRQueueLength(),
        facadeQueueBuffered: this.queues.size() - getSSRQueueLength(),
        capacity,
      },
      urls: {
        lastPlanned: this.ctx.getLastPlannedUrl(),
        lastSent: this.ctx.getLastSentUrl(),
      },
    };
  }
}
