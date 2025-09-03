import { ConsentStatus } from "../consent/types";
import { DiagnosticsSnapshot } from "../facade/diagnostics";
import { InitOptions } from "../types";


export interface Analytics {
  init(opts?: InitOptions): this;

  // events
  track(name: string, props?: Record<string, unknown>, category?: string): void;
  pageview(url?: string): void;
  identify(userId: string | null): void;

  // consent
  consent: {
    get(): ConsentStatus | 'unknown';
    set(status: ConsentStatus): void;
    grant(): void;
    deny(): void;
    reset(): void;
  };

  // readiness (split for clarity)
  ready: {
    provider(options?: { timeoutMs?: number }): Promise<void>; // provider loaded
    tracking(options?: { timeoutMs?: number }): Promise<void>; // provider ready + consent resolved
  };

  // queue helpers
  queue: {
    has(): boolean;
    flushIfReady(): boolean;
  };

  diagnostics(): DiagnosticsSnapshot;
  destroy(): void;
}
