import type { BaseAnalyticsClient } from './types';
import type { PageContext, Props } from '../../types';
import { isBrowser, isPageHidden } from './browser';
import { Transport, createTransport } from './transport';

/**
 * Simplified base class for analytics clients
 * The facade handles error management, consent, and debug logging
 */
export abstract class BaseClient<TConfig = any> implements BaseAnalyticsClient {
  protected config: TConfig;
  protected transport: Transport;
  private allowWhenHidden: boolean;
  
  constructor(config: TConfig, allowWhenHidden = false) {
    this.config = config;
    this.allowWhenHidden = allowWhenHidden;
    this.transport = this.createTransport();
  }
  
  /**
   * Send an event - must be implemented by each provider
   * Should throw errors - facade will handle them
   */
  abstract sendEvent(eventName: string, props?: Props, url?: string, pageContext?: PageContext): Promise<void>;
  
  /**
   * Send a pageview - can be overridden if provider needs special handling
   */
  async sendPageview(url?: string, pageContext?: PageContext): Promise<void> {
    // Default implementation just sends a pageview event
    await this.sendEvent('pageview', {}, url, pageContext);
  }
  
  /**
   * Check if tracking should occur (basic environment checks only)
   * The facade handles consent and other business logic
   */
  protected shouldTrack(): boolean {
    if (!isBrowser()) {
      return false;
    }
    
    if (!this.allowWhenHidden && isPageHidden()) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Create transport instance - can be overridden
   */
  protected createTransport(): Transport {
    return createTransport();
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Base implementation - providers can override to add cleanup
  }
}