import type { AnalyticsInstance, AnalyticsOptions } from '../types';
import type { ProviderInstance } from './types';
import { StateMachine } from '../util/state';
import { logger } from '../util/logger';
import { AnalyticsError } from '../errors';

/**
 * Wraps a provider instance with state management and queueing
 */
export class StatefulProvider implements AnalyticsInstance {
  private provider: ProviderInstance;
  private state: StateMachine;

  track!:     AnalyticsInstance['track'];
  pageview!:  AnalyticsInstance['pageview'];
  identify!:  AnalyticsInstance['identify'];
  setConsent!:AnalyticsInstance['setConsent'];

  constructor(
    provider: ProviderInstance,
    private options: AnalyticsOptions,
    private onReady?: () => void,
  ) {
    this.provider = provider;
    this.state = new StateMachine();

    this.track     = this.provider.track.bind(this.provider);
    this.pageview  = this.provider.pageview.bind(this.provider);
    this.identify  = this.provider.identify.bind(this.provider);
    this.setConsent= (s) => this.provider.setConsent?.(s);
    
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
      if (newState === 'ready') {
        this.onReady?.();
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
      this.onReady?.();
    } catch (error) {
      this.state.transition('ERROR');
      throw error;
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
}