import type { FacadeOptions } from '../types';
import { type QueueService, getSSRQueueLength } from '../queues';
import type { ContextService } from './context';
import type { ProviderManager } from './provider-manager';
import type { ConsentStatus, ConsentStoredState } from '../consent/types';
import type { ProviderState } from '../providers/types';
import type { ProviderStateHistory } from '../util/state';
import { PerformanceTracker } from '../performance/tracker';

export interface ProviderStateSnapshot {
  provider: string | null;
  state: ProviderState | 'unknown';
  details?: unknown;
}

export interface DiagnosticsSnapshot {
  timestamp: number;
  instanceId: string;
  config: {
    debug?: boolean;
    queueSize?: number;
    autoTrack?: boolean;
    doNotTrack?: boolean;
    trackLocalhost?: boolean;
    includeHash?: boolean;
    transport?: 'auto' | 'beacon' | 'fetch' | 'xhr';
    domains?: string[];
  };
  consent: {
    status?: ConsentStatus;
    version?: string;
    method?: string;
  };
  performance?: {
    initTime: number;
    avgProcessingTime: number;
    avgNetworkLatency: number;
    totalEvents: number;
    failedEvents: number;
  };
  provider: {
    key: string | null;
    state: ProviderState;  // provider.getState() payload passthrough
    history: ProviderStateHistory;  // provider.getState() payload passthrough
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
 * - provider: current provider key + provider-reported state/history
 * - queue: combined SSR + runtime buffer size and capacity
 * - urls: last planned and last sent URLs from the context service
 *
 * Used by `getDiagnostics()` on the facade to support debugging and health checks.
 */
export class DiagnosticsService {
  constructor(
    private id: string,
    private cfg: FacadeOptions,
    private consent: {
      snapshot(): ConsentStoredState | undefined;
    } | null,
    private queues: QueueService,
    private ctx: ContextService,
    private provider: ProviderManager,
    private providerKey: string | null,
    private performanceTracker: PerformanceTracker | null,
  ) {}

  getSnapshot(): DiagnosticsSnapshot {
    const capacity = this.cfg?.queueSize ?? 50;

    const p = this.provider.get();
    const providerSnapshot =
      p && typeof (p as any).getSnapshot === 'function'
        ? (p as any).getSnapshot()
        : { state: 'unknown' as ProviderState, history: [] as ProviderStateHistory };

    return {
      timestamp: Date.now(),
      instanceId: this.id,
      config: {
        debug: this.cfg?.debug,
        queueSize: this.cfg?.queueSize,
        autoTrack: this.cfg?.autoTrack,
        doNotTrack: this.cfg?.doNotTrack,
        trackLocalhost: this.cfg?.trackLocalhost,
        includeHash: this.cfg?.includeHash,
        transport: this.cfg?.transport,
        domains: this.cfg?.domains,
      },
      consent: {
        ...this.consent?.snapshot(),
      },
      performance: this.performanceTracker
        ? {
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
