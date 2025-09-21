import type { ProviderInstance } from '../types';
import { StateMachine } from '../util/state';
import { logger } from '../util/logger';
import { AnalyticsError } from '../errors';

/**
 * Wraps a provider instance with state management and queueing
 */
export class StatefulProvider implements ProviderInstance {
  private readyCallbacks: Array<() => void> = [];
  private provider: ProviderInstance;
  private state: StateMachine;

  track!:     ProviderInstance['track'];
  pageview!:  ProviderInstance['pageview'];
  identify!:  ProviderInstance['identify'];

  constructor(
    provider: ProviderInstance,
    onError?: (error: AnalyticsError) => void,
  ) {
    this.provider = provider;
    this.state = new StateMachine();

    this.track     = this.provider.track.bind(this.provider);
    this.pageview  = this.provider.pageview.bind(this.provider);
    this.identify  = this.provider.identify.bind(this.provider);
    
    // Subscribe to state changes
    this.state.subscribe((newState, oldState, event) => {
      logger.debug('Provider state changed', { from: oldState, to: newState, via: event });
      if (event === 'ERROR') {
        logger.error('Provider encountered an error');
        onError?.(
          new AnalyticsError(
            'Provider error',
            'PROVIDER_ERROR',
            this.provider.name,
          )
        );
      }
      if (newState === 'ready' && oldState !== 'ready') {
        // Notify all ready callbacks
        this.readyCallbacks.forEach(cb => {
          try {
            cb();
          } catch (error) {
            logger.error('Error in ready callback', error);
          }
        });
        this.readyCallbacks = [];
      }
    });
  }

  /**
   * Get the provider name
   */
  get name(): string {
    return this.provider.name || 'stateful-provider';
  }
  
  /**
   * Initialize the provider
   */
  async init(): Promise<void> {
    logger.debug(`Initializing provider: ${this.provider.name}`);
    if (this.state.getState() !== 'idle') {
      logger.warn('Provider already initialized');
      return;
    }
    
    this.state.transition('INIT');
    
    try {
      logger.debug(`Provider initialized: ${this.provider.name}`);
      this.state.transition('READY');
    } catch (error) {
      logger.error(`Provider initialization failed: ${this.provider.name}`, error);
      this.state.transition('ERROR');
      throw error;
    }
  }

  /**
   * Register a callback for when provider is ready
   */
  onReady(callback: () => void): () => void {
    if (this.state.getState() === 'ready') {
      // Already ready, call immediately
      queueMicrotask(() => {
        try { callback(); } catch { /* swallow */ }
      });
      return () => { /* no-op */ };
    } else {
      this.readyCallbacks.push(callback);
      return () => {
        this.readyCallbacks = this.readyCallbacks.filter(cb => cb !== callback);
      };
    }
  }

  /**
   * Destroy the instance
   */
  destroy(): void {
    if (this.state.isTerminal()) {
      return;
    }
    
    this.state.transition('DESTROY');
    this.provider.destroy();
  }
  
  /**
   * Get current state (for debugging)
   */
  getState() {
    return this.state.getState();
  }

  /**
   * Get snapshot of state and history (for diagnostics)
   */
  getSnapshot() {
    return {
      state: this.state.getState(),
      history: this.state.getHistory(),
    };
  }
}