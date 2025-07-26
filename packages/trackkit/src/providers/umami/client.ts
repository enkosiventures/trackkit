import type { UmamiConfig, UmamiPayload } from './types';
import type { Props } from '../../types';
import { BaseClient } from '../shared/base-client';
import { 
  isDoNotTrackEnabled, 
  isDomainAllowed,
  isLocalhost,
  getPageUrl,
} from '../shared/browser';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Umami-specific client implementation
 */
export class UmamiClient extends BaseClient<Required<UmamiConfig>> {
  constructor(config: UmamiConfig) {
    const fullConfig: Required<UmamiConfig> = {
      websiteId: config.websiteId,
      hostUrl: config.hostUrl || 'https://cloud.umami.is',
      autoTrack: config.autoTrack ?? true,
      doNotTrack: config.doNotTrack ?? true,
      domains: config.domains || [],
      cache: config.cache ?? false,
    };
    
    super(fullConfig, false); // Don't allow tracking when page is hidden
  }
  
  /**
   * Send event to Umami
   */
  async sendEvent(name: string, props?: Props, url?: string): Promise<void> {
    if (!this.shouldTrack()) return;
    
    // Additional Umami-specific checks
    if (!this.shouldTrackUmami()) return;
    
    const payload: UmamiPayload = {
      website: this.config.websiteId,
      hostname: window.location.hostname,
      language: this.browserData.language,
      screen: `${this.browserData.screen.width}x${this.browserData.screen.height}`,
      title: this.browserData.title,
      url: url || this.browserData.url,
      referrer: this.browserData.referrer,
      name,
      data: props,
    };
    
    await this.send('event', payload);
  }
  
  /**
   * Send pageview to Umami
   */
  async sendPageview(url?: string, title?: string): Promise<void> {
    if (!this.shouldTrack()) return;
    if (!this.shouldTrackUmami()) return;
    
    const payload: UmamiPayload = {
      website: this.config.websiteId,
      hostname: window.location.hostname,
      language: this.browserData.language,
      screen: `${this.browserData.screen.width}x${this.browserData.screen.height}`,
      title: title || this.browserData.title,
      url: url || this.browserData.url,
      referrer: this.browserData.referrer,
    };
    
    await this.send('pageview', payload);
  }
  
  /**
   * Check Umami-specific tracking conditions
   */
  private shouldTrackUmami(): boolean {
    // Check Do Not Track
    if (this.config.doNotTrack && isDoNotTrackEnabled()) {
      this.debug('Umami: Do Not Track is enabled');
      return false;
    }
    
    // Check domain whitelist
    if (!isDomainAllowed(this.config.domains)) {
      this.debug('Umami: Domain not in whitelist');
      return false;
    }
    
    return true;
  }
  
  /**
   * Send data to Umami API
   */
  private async send(type: 'pageview' | 'event', payload: UmamiPayload): Promise<void> {
    const endpoint = this.getEndpoint();
    const cacheParam = this.config.cache ? `?cache=${Date.now()}` : '';
    const url = `${endpoint}/api/send${cacheParam}`;
    
    this.debug(`Sending ${type} to Umami`, { url, payload });
    
    try {
      await this.transport.send(url, payload, {
        method: 'POST',
        headers: {
          'User-Agent': 'Trackkit/1.0',
        },
      });
      
      this.debug(`Umami ${type} sent successfully`);
    } catch (error) {
      const analyticsError = error instanceof AnalyticsError
        ? error
        : new AnalyticsError(
            'Failed to send event to Umami',
            'NETWORK_ERROR',
            'umami',
            error
          );
          
      this.handleError(analyticsError, `Umami ${type}`);
      throw analyticsError;
    }
  }
  
  /**
   * Get API endpoint
   */
  private getEndpoint(): string {
    return this.config.hostUrl.replace(/\/$/, '');
  }
}