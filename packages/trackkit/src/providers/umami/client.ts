import type { UmamiConfig, UmamiPayload, UmamiResponse } from './types';
import { 
  getApiEndpoint, 
  getFetchOptions, 
  getBrowserData,
  shouldTrackDomain,
  isDoNotTrackEnabled 
} from './utils';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Umami API client for browser environments
 */
export class UmamiClient {
  private config: Required<UmamiConfig>;
  private browserData: ReturnType<typeof getBrowserData>;
  
  constructor(config: UmamiConfig) {
    this.config = {
      websiteId: config.websiteId,
      hostUrl: config.hostUrl || 'https://cloud.umami.is',
      autoTrack: config.autoTrack ?? true,
      doNotTrack: config.doNotTrack ?? true,
      domains: config.domains || [],
      cache: config.cache ?? true,
    };
    
    this.browserData = getBrowserData();
  }
  
  /**
   * Check if tracking should be performed
   */
  private shouldTrack(): boolean {
    // Check Do Not Track
    if (this.config.doNotTrack && isDoNotTrackEnabled()) {
      logger.debug('Tracking disabled: Do Not Track is enabled');
      return false;
    }
    
    // Check domain whitelist
    if (!shouldTrackDomain(this.config.domains)) {
      logger.debug('Tracking disabled: Domain not in whitelist');
      return false;
    }
    
    return true;
  }
  
  /**
   * Send event to Umami
   */
  async send(type: 'pageview' | 'event', payload: Partial<UmamiPayload>): Promise<void> {
    if (!this.shouldTrack()) {
      return;
    }
    
    const endpoint = type === 'pageview' ? '/api/send' : '/api/send';
    const url = getApiEndpoint(this.config.hostUrl, endpoint, this.config.cache);
    
    // Merge with browser data
    const fullPayload: UmamiPayload = {
      website: this.config.websiteId,
      hostname: window.location.hostname,
      ...this.browserData,
      ...payload,
    };
    
    logger.debug(`Sending ${type} to Umami`, { url, payload: fullPayload });
    
    try {
      const response = await fetch(url, getFetchOptions(fullPayload));
      
      if (!response.ok) {
        throw new AnalyticsError(
          `Umami request failed: ${response.status} ${response.statusText}`,
          'NETWORK_ERROR',
          'umami'
        );
      }
      
      logger.debug(`${type} sent successfully`);
      
    } catch (error) {
      if (error instanceof AnalyticsError) {
        throw error;
      }
      
      throw new AnalyticsError(
        'Failed to send event to Umami',
        'NETWORK_ERROR',
        'umami',
        error
      );
    }
  }
  
  /**
   * Track a pageview
   */
  async trackPageview(url?: string): Promise<void> {
    const payload: Partial<UmamiPayload> = {
      url: url || this.browserData.url,
      title: document.title,
      referrer: this.browserData.referrer,
    };
    
    console.warn('Tracking pageview:', payload); // DEBUG
    await this.send('pageview', payload);
    console.warn('Pageview tracked successfully'); // DEBUG
  }

  /**
   * Track a custom event
   */
  async trackEvent(
    name: string, 
    data?: Record<string, unknown>,
    url?: string
  ): Promise<void> {
    const payload: Partial<UmamiPayload> = {
      name,
      data,
      url: url || this.browserData.url,
    };
    
    await this.send('event', payload);
  }
  
  /**
   * Update browser data (call on navigation)
   */
  updateBrowserData(): void {
    this.browserData = getBrowserData();
  }
}