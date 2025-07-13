import type { AnalyticsInstance, AnalyticsOptions } from '../types';
import type { ProviderInstance } from './types';
import { EventQueue, type QueuedEventUnion } from '../util/queue';
import { StateMachine } from '../util/state';
import { logger } from '../util/logger';
import { AnalyticsError } from '../errors';

/**
 * Wraps a provider instance with state management and queueing
 */
export class StatefulProvider implements AnalyticsInstance {
  private provider: ProviderInstance;
  private queue: EventQueue;
  private state: StateMachine;
  private flushPromise?: Promise<void>;

  constructor(
    provider: ProviderInstance,
    options: AnalyticsOptions
  ) {
    this.provider = provider;
    this.state = new StateMachine();
    this.queue = new EventQueue({
      maxSize: options.queueSize || 50,
      debug: options.debug,
      onOverflow: (dropped) => {
        const error = new AnalyticsError(
          `Queue overflow: ${dropped.length} events dropped`,
          'QUEUE_OVERFLOW'
        );
        options.onError?.(error);
      },
    });
    
    // Subscribe to state changes
    this.state.subscribe((newState, oldState) => {
      logger.debug('Provider state changed', { from: oldState, to: newState });
      
      if (newState === 'ready' && !this.queue.isEmpty) {
        this.flushQueue();
      }
    });
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
   * Track event (queued if not ready)
   */
  track(name: string, props?: Record<string, unknown>, url?: string): void {
    if (this.state.getState() === 'ready') {
      this.provider.track(name, props, url);
    } else {
      this.queue.enqueue('track', [name, props, url]);
    }
  }
  
  /**
   * Track pageview (queued if not ready)
   */
  pageview(url?: string): void {
    if (this.state.getState() === 'ready') {
      this.provider.pageview(url);
    } else {
      this.queue.enqueue('pageview', [url]);
    }
  }
  
  /**
   * Identify user (queued if not ready)
   */
  identify(userId: string | null): void {
    if (this.state.getState() === 'ready') {
      this.provider.identify(userId);
    } else {
      this.queue.enqueue('identify', [userId]);
    }
  }
  
  /**
   * Set consent (always processed immediately)
   */
  setConsent(state: 'granted' | 'denied'): void {
    // Consent changes are always processed immediately
    this.provider.setConsent(state);
    
    if (state === 'denied') {
      // Clear queue on consent denial
      this.queue.clear();
      this.queue.pause();
    } else {
      this.queue.resume();
      
      // Flush queue if provider is ready
      if (this.state.getState() === 'ready' && !this.queue.isEmpty) {
        this.flushQueue();
      }
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
    this.queue.clear();
    this.provider.destroy();
  }
  
  /**
   * Get current state (for debugging)
   */
  getState() {
    return {
      provider: this.state.getState(),
      queue: this.queue.getState(),
      history: this.state.getHistory(),
    };
  }
  
  /**
   * Process queued events
   */
  private async flushQueue(): Promise<void> {
    // Prevent concurrent flushes
    if (this.flushPromise) {
      return this.flushPromise;
    }
    
    this.flushPromise = this.processQueuedEvents();
    
    try {
      await this.flushPromise;
    } finally {
      this.flushPromise = undefined;
    }
  }
  
  private async processQueuedEvents(): Promise<void> {
    const events = this.queue.flush();
    
    if (events.length === 0) {
      return;
    }
    
    logger.info(`Processing ${events.length} queued events`);
    
    for (const event of events) {
      try {
        switch (event.type) {
          case 'track':
            this.provider.track(...event.args);
            break;
          case 'pageview':
            this.provider.pageview(...event.args);
            break;
          case 'identify':
            this.provider.identify(...event.args);
            break;
          case 'setConsent':
            this.provider.setConsent(...event.args);
            break;
        }
      } catch (error) {
        logger.error('Error processing queued event', {
          event: event.type,
          error,
        });
      }
    }
  }
}