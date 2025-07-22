import { AnalyticsError } from '../errors'; // adjust path if different
import { isBrowser } from '../util/env';    // or your existing env helper
import { logger } from '../util/logger';
import { ConsentOptions, ConsentSnapshot, ConsentStatus, ConsentStoredState, Listener } from './types';


export class ConsentManager {
  private status: ConsentStatus = 'pending';
  private opts: Required<Omit<ConsentOptions,'policyVersion'|'requireExplicit'>> & {
    policyVersion?: string; requireExplicit?: boolean;
  };
  private listeners = new Set<Listener>();
  private storageAvailable = false;
  private queueCounter = 0;
  private droppedDeniedCounter = 0;

  constructor(options: ConsentOptions = {}) {
    this.opts = {
      storageKey: options.storageKey || '__trackkit_consent__',
      disablePersistence: !!options.disablePersistence,
      policyVersion: options.policyVersion,
      requireExplicit: options.requireExplicit ?? true,
    };
    console.warn('ConsentManager Options:', this.opts);
    this.initFromStorage();
  }

  private initFromStorage() {
    if (!isBrowser() || this.opts.disablePersistence) return;
    try {
      const raw = window.localStorage.getItem(this.opts.storageKey);
      this.storageAvailable = true;
      if (!raw) {
        // If explicit consent NOT required we may auto‑grant (implicit) on first track.
        // this.status = this.opts.requireExplicit ? 'pending' : 'granted'; // still pending until we see a track (implicit promotion hook)
        this.status = 'pending'; // always start as pending
        return;
      }
      const parsed: ConsentStoredState = JSON.parse(raw);
      // Version bump logic
      if (this.shouldRePrompt(parsed.version)) {
        this.status = 'pending';
        return;
      }
      this.status = parsed.status;
    } catch {
      // ignore corrupt storage
      this.status = 'pending';
    }
  }

  private persist() {
    if (!this.storageAvailable || this.opts.disablePersistence) return;
    try {
      const state: ConsentStoredState = {
        status: this.status,
        timestamp: Date.now(),
        version: this.opts.policyVersion,
        method: 'explicit',
      };
      window.localStorage.setItem(this.opts.storageKey, JSON.stringify(state));
    } catch {
      // swallow; optionally emit error through outer facade if desired
    }
  }

  private shouldRePrompt(stored?: string) {
    if (!this.opts.policyVersion) return false;
    if (!stored) return true;
    // Simple semver-ish numeric/lex compare; customize as needed.
    return stored !== this.opts.policyVersion;
  }

  getStatus(): ConsentStatus {
    return this.status;
  }

  isGranted(category?: string) {
    // “granted” covers all categories
    if (this.status === 'granted') return true;
    // “denied” blocks everything
    if (this.status === 'denied')  return false;
    // “pending”: allow *essential* only
    return category === 'essential';
  }

  /** Called by facade when first *emittable* event arrives and implicit allowed. */
  promoteImplicitIfAllowed() {
    if (this.status === 'pending' && !this.opts.requireExplicit) {
      console.warn('Implicit consent granted on first emittable event');
      this.status = 'granted'; // Don't call setStatus to avoid 'explicit' method
      // Manually persist with 'implicit' method
      if (this.storageAvailable && !this.opts.disablePersistence) {
        try {
          const state: ConsentStoredState = {
            status: this.status,
            timestamp: Date.now(),
            version: this.opts.policyVersion,
            method: 'implicit'
          };
          window.localStorage.setItem(this.opts.storageKey, JSON.stringify(state));
        } catch {
          logger.warn('Failed to persist implicit consent');
        }
      }
      this.notify('pending');
    }
  }

  grant() {
    this.setStatus('granted', true);
  }
  deny() {
    this.setStatus('denied', true);
  }
  reset() {
    const prev = this.status;
    this.status = 'pending';
    this.persist();
    this.notify(prev);
  }

  /** Facade increments when queueing pre‑consent events */
  incrementQueued() {
    this.queueCounter++;
  }
  /** Facade increments when dropping due to denied */
  incrementDroppedDenied() {
    this.droppedDeniedCounter++;
  }

  snapshot(): ConsentSnapshot {
    return {
      status: this.status,
      timestamp: Date.now(),
      version: this.opts.policyVersion,
      method: this.opts.requireExplicit ? 'explicit' : 'implicit',
      queuedEvents: this.queueCounter,
      droppedEventsDenied: this.droppedDeniedCounter
    };
  }

  onChange(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private setStatus(next: ConsentStatus, persist = true) {
    if (this.status === next) return;
    const prev = this.status;
    this.status = next;
    if (persist) this.persist();
    this.notify(prev);
  }

  private notify(prev: ConsentStatus) {
    for (const l of [...this.listeners]) {
      try { l(this.status, prev); } catch (e) {
        // Swallow or escalate via a global error dispatcher
        // (Add optional callback hook if needed)
      }
    }
  }
}
