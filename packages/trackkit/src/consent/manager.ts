import type { ConsentState, ConsentStatus, ConsentOptions, ConsentEvaluator, EventClassification } from './types';
import { logger } from '../util/logger';

const DEFAULT_STORAGE_KEY = 'trackkit_consent';

/**
 * Minimal consent manager - core functionality only
 */
export class ConsentManager implements ConsentEvaluator {
  private state: ConsentState;
  private options: Required<ConsentOptions>;
  private listeners = new Set<(state: ConsentState) => void>();
  
  constructor(options: ConsentOptions = {}) {
    this.options = {
      initial: 'pending',
      storageKey: DEFAULT_STORAGE_KEY,
      disablePersistence: false,
      onChange: (...args) => {
        logger.warn('Consent onChange callback not implemented', ...args);
      },
      requireExplicit: true,
      ...options,
    };
    
    // Initialize state
    this.state = this.loadState();
    
    logger.debug('Consent manager initialized', {
      status: this.state.status,
      persisted: !this.options.disablePersistence,
    });
  }
  
  /**
   * Load state from storage or use initial
   */
  private loadState(): ConsentState {
    // Try loading from storage first
    if (!this.options.disablePersistence && typeof window !== 'undefined') {
      try {
        const stored = window.localStorage.getItem(this.options.storageKey);
        if (stored) {
          const parsed = JSON.parse(stored) as ConsentState;
          // Validate stored state
          if (this.isValidState(parsed)) {
            logger.debug('Loaded consent from storage', parsed);
            return parsed;
          }
        }
      } catch (error) {
        logger.warn('Failed to load consent from storage', error);
      }
    }
    
    // Use initial state
    const initial = this.options.initial;
    if (typeof initial === 'string') {
      return {
        status: initial,
        timestamp: Date.now(),
        method: this.options.requireExplicit ? undefined : 'implicit',
      };
    } else if (initial && typeof initial === 'object') {
      return {
        ...initial,
        timestamp: initial.timestamp || Date.now(),
      };
    }
    
    // Default to pending
    return {
      status: 'pending',
      timestamp: Date.now(),
    };
  }
  
  /**
   * Validate state object
   */
  private isValidState(state: any): state is ConsentState {
    return (
      state &&
      typeof state === 'object' &&
      ['pending', 'granted', 'denied'].includes(state.status) &&
      typeof state.timestamp === 'number'
    );
  }
  
  /**
   * Persist current state
   */
  private persistState(): void {
    if (this.options.disablePersistence || typeof window === 'undefined') {
      return;
    }
    
    try {
      window.localStorage.setItem(
        this.options.storageKey,
        JSON.stringify(this.state)
      );
    } catch (error) {
      logger.warn('Failed to persist consent', error);
    }
  }
  
  /**
   * Get current consent state
   */
  getState(): ConsentState {
    return { ...this.state };
  }
  
  /**
   * Check if tracking is allowed
   */
  canTrack(classification?: EventClassification): boolean {
    // Future: check classification.requiresConsent
    // For now, simple binary check
    return this.state.status === 'granted';
  }
  
  /**
   * Update consent state
   */
  private updateState(newState: Partial<ConsentState>): void {
    const previousState = { ...this.state };
    
    this.state = {
      ...this.state,
      ...newState,
      timestamp: Date.now(),
    };
    
    // Persist immediately
    this.persistState();
    
    // Log state change
    logger.info('Consent updated', {
      from: previousState.status,
      to: this.state.status,
      method: this.state.method,
    });
    
    // Notify listeners
    this.notifyListeners(previousState);
  }
  
  /**
   * Notify all listeners of state change
   */
  private notifyListeners(previousState: ConsentState): void {
    // Built-in callback
    if (this.options.onChange) {
      try {
        this.options.onChange(this.getState(), previousState);
      } catch (error) {
        logger.error('Error in consent onChange callback', error);
      }
    }
    
    // Subscribed listeners
    this.listeners.forEach(listener => {
      try {
        listener(this.getState());
      } catch (error) {
        logger.error('Error in consent listener', error);
      }
    });
  }
  
  /**
   * Grant consent
   */
  grant(): void {
    this.updateState({
      status: 'granted',
      method: 'explicit',
    });
  }
  
  /**
   * Deny consent
   */
  deny(): void {
    this.updateState({
      status: 'denied',
      method: 'explicit',
    });
  }
  
  /**
   * Reset to pending state
   */
  reset(): void {
    if (!this.options.disablePersistence && typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(this.options.storageKey);
      } catch (error) {
        logger.warn('Failed to clear stored consent', error);
      }
    }
    
    this.updateState({
      status: 'pending',
      method: undefined,
    });
  }
  
  /**
   * Subscribe to consent changes
   */
  subscribe(callback: (state: ConsentState) => void): () => void {
    this.listeners.add(callback);
    // Return unsubscribe function
    return () => this.listeners.delete(callback);
  }
}