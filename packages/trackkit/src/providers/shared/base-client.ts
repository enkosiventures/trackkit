import type { BaseAnalyticsClient, BaseClientConfig, BrowserData } from './types';
import type { Props } from '../../types';
import { getBrowserData, isBrowser, isPageHidden } from './browser';
import { Transport, createTransport } from './transport';
import { logger } from '../../util/logger';

/**
 * Base class for analytics clients
 * Provides common functionality that all providers can use
 */
export abstract class BaseClient<TConfig extends BaseClientConfig = BaseClientConfig> 
  implements BaseAnalyticsClient {
  
  protected config: TConfig;
  protected transport: Transport;
  protected browserData: BrowserData;
  private allowWhenHidden: boolean;
  
  constructor(config: TConfig, allowWhenHidden = false) {
    this.config = config;
    this.allowWhenHidden = allowWhenHidden;
    this.browserData = getBrowserData();
    this.transport = this.createTransport();
  }
  
  /**
   * Send an event - must be implemented by each provider
   */
  abstract sendEvent(eventName: string, props?: Props, url?: string): Promise<void>;
  
  /**
   * Send a pageview - can be overridden if provider needs special handling
   */
  async sendPageview(url?: string, title?: string): Promise<void> {
    // Default implementation just sends a pageview event
    await this.sendEvent('pageview', { url, title }, url);
  }
  
  /**
   * Check if tracking should occur
   */
  protected shouldTrack(): boolean {
    if (!isBrowser()) {
      logger.debug('Tracking disabled: not in browser environment');
      return false;
    }
    
    if (!this.allowWhenHidden && isPageHidden()) {
      logger.debug('Tracking disabled: page is hidden');
      return false;
    }
    
    return true;
  }
  
  /**
   * Update browser data (e.g., after navigation)
   */
  updateBrowserData(): void {
    this.browserData = getBrowserData();
  }
  
  /**
   * Create transport instance - can be overridden
   */
  protected createTransport(): Transport {
    return createTransport();
  }
  
  /**
   * Log debug message if debug mode is enabled
   */
  protected debug(message: string, data?: any): void {
    if (this.config.debug) {
      logger.debug(message, data);
    }
  }
  
  /**
   * Handle errors consistently
   */
  protected handleError(error: unknown, context: string): void {
    logger.error(`${context} error:`, error);
    
    if (this.config.onError) {
      try {
        this.config.onError(error instanceof Error ? error : new Error(String(error)));
      } catch (callbackError) {
        logger.error('Error in onError callback:', callbackError);
      }
    }
  }
  
  /**
   * Clean up resources
   */
  destroy(): void {
    // Base implementation - providers can override to add cleanup
    logger.debug('Destroying analytics client');
  }
}