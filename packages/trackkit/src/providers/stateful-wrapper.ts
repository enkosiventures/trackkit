import type { AnalyticsInstance, AnalyticsOptions } from '../types';
import type { ProviderInstance } from './types';
import { StateMachine } from '../util/state';
import { logger } from '../util/logger';
import { AnalyticsError } from '../errors';

/**
 * Wraps a provider instance with state management and queueing
 */
export class StatefulProvider implements AnalyticsInstance {
  private readyCallbacks: Array<() => void> = [];
  private provider: ProviderInstance;
  private state: StateMachine;

  track!:     AnalyticsInstance['track'];
  pageview!:  AnalyticsInstance['pageview'];
  identify!:  AnalyticsInstance['identify'];

  constructor(
    provider: ProviderInstance,
    private options: AnalyticsOptions,
    // private onReady?: (provider: StatefulProvider) => void,
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
        this.options.onError?.(
          new AnalyticsError(
            'Provider error',
            'PROVIDER_ERROR',
            this.provider.name,
          )
        );
      } else if (newState === 'destroyed') {
        this.provider.destroy();
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
        // this.onReady?.(this);
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
    if (this.state.getState() !== 'idle') {
      logger.warn('Provider already initialized');
      return;
    }
    
    this.state.transition('INIT');
    
    try {
      // Call provider's init if it exists
      if (this.provider._init) {
        await this.provider._init();
      }
      
      this.state.transition('READY');
    } catch (error) {
      this.state.transition('ERROR');
      throw error;
    }
  }

  /**
   * Register a callback for when provider is ready
   */
  onReady(callback: () => void): void {
    if (this.state.getState() === 'ready') {
      // Already ready, call immediately
      callback();
    } else {
      this.readyCallbacks.push(callback);
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
    return {
      provider: this.state.getState(),
      history: this.state.getHistory(),
    };
  }

  /**
   * Set a callback for navigation events
   * Used by providers that detect client-side navigation
   */
  setNavigationCallback(callback: (url: string) => void): void {
    if (this.provider._setNavigationCallback) {
      this.provider._setNavigationCallback(callback);
    } else {
      logger.warn('Provider does not support navigation callbacks');
    }
  }
}