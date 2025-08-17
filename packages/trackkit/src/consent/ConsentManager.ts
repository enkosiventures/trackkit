import { STORAGE_KEY } from '../constants';
import { isBrowser } from '../util/env';
import { logger } from '../util/logger';
import type { ConsentCategory, ConsentOptions, ConsentSnapshot, ConsentStatus, ConsentStoredState, Listener } from './types';


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
      initialStatus: options.initialStatus || 'pending',
      storageKey: options.storageKey || STORAGE_KEY,
      disablePersistence: !!options.disablePersistence,
      policyVersion: options.policyVersion,
      requireExplicit: options.requireExplicit ?? true,
      allowEssentialOnDenied: options.allowEssentialOnDenied ?? false,
    };

    this.status = this.opts.initialStatus;

    logger.debug('ConsentManager Options:', this.opts);
    this.initFromStorage();
  }

  private initFromStorage() {
    if (!isBrowser() || this.opts.disablePersistence) return;
    try {
      const raw = window.localStorage.getItem(this.opts.storageKey);
      this.storageAvailable = true;
      if (!raw) {
        return;
      }
      const parsed: ConsentStoredState = JSON.parse(raw);
      // Version bump logic
      if (this.shouldRePrompt(parsed.version)) {
        return;
      }
      // Valid stored state overrides initialStatus
      this.status = parsed.status;
    } catch {
      // ignore corrupt storage
      this.status = this.opts.initialStatus;
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

  /**
   * Core: may I send an event in this category?
   * - Essential always allowed (except if allowEssentialOnDenied === false *and* status === 'denied')
   * - Non-essential only when granted
   */
  isAllowed(category: ConsentCategory = 'analytics'): boolean {
    if (category === 'essential') {
      // allowed unless explicitly denied AND not allowed-by-config
      return this.status !== 'denied' || this.opts.allowEssentialOnDenied;
    }
    return this.status === 'granted';
  }

  /** Called by facade when first *emittable* event arrives and implicit allowed. */
  promoteImplicitIfAllowed() {
    if (this.status === 'pending' && !this.opts.requireExplicit) {
      logger.info('Implicit consent granted on first emittable event');
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
      try { l(this.status, prev); } catch {
        // Swallow or escalate via a global error dispatcher
        // (Add optional callback hook if needed)
      }
    }
  }
}
