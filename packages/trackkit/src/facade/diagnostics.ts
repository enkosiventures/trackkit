import type { FacadeOptions } from '../types';
import type { QueueService } from './queues';
import type { ContextService } from './context';
import type { ProviderManager } from './provider-manager';
import { ConsentStatus } from '../consent/types';
import { ProviderState } from '../providers/types';
import { ProviderStateHistory } from '../util/state';

export interface ProviderStateSnapshot {
  provider: string | null;
  state: ProviderState | 'unknown';
  details?: unknown;
}

export interface DiagnosticsSnapshot {
  ts: number;
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
    status: ConsentStatus | 'unknown';
    policyVersion?: string;
  };
  provider: {
    key: string | null;
    state: ProviderState;  // provider.getState() payload passthrough
    history: ProviderStateHistory;  // provider.getState() payload passthrough
  };
  queue: {
    totalBuffered: number;   // SSR + facade
    capacity: number;
  };
  urls: {
    lastPlanned: string | null;
    lastSent: string | null;
  };
}

export class DiagnosticsService {
  constructor(
    private id: string,
    private cfg: FacadeOptions,
    private consent: {
      getStatus(): ConsentStatus | undefined;
      getPolicyVersion?(): string | undefined;
    } | null,
    private queues: QueueService,
    private ctx: ContextService,
    private provider: ProviderManager,
    private providerKey: string | null,
  ) {}

  getSnapshot(): DiagnosticsSnapshot {
    const status = this.consent?.getStatus() ?? 'unknown';
    const capacity = this.cfg?.queueSize ?? 50;

    const p = this.provider.get();
    const providerSnapshot = typeof p?.getSnapshot === 'function' ? p!.getSnapshot() : { state: 'unknown' as ProviderState, history: [] as ProviderStateHistory };

    return {
      ts: Date.now(),
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
        status,
        policyVersion: this.consent?.getPolicyVersion?.(),
      },
      provider: {
        key: this.providerKey,
        ...providerSnapshot,
      },
      queue: {
        totalBuffered: this.queues.size(),
        capacity,
      },
      urls: {
        lastPlanned: this.ctx.getLastPlannedUrl(),
        lastSent: this.ctx.getLastSentUrl(),
      },
    };
  }
}
