import type { UmamiPayload } from './types';
import type { PageContext, Props } from '../../types';
import { BaseClient } from '../shared/base-client';
import { 
  isDoNotTrackEnabled, 
  isDomainAllowed,
} from '../shared/browser';
import { AnalyticsError } from '../../errors';
import { debugLog, logger } from '../../util/logger';
import { getSize } from '../shared/utils';

/**
 * Umami-specific client implementation
 * The facade handles consent, error management, and debug logging
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
      onError: config.onError ?? ((error) => { logger.error(error)}),
    };
    
    super(fullConfig, false); // Don't allow tracking when page is hidden
  }
  
  /**
   * Send event to Umami
   */
  async sendEvent(name: string, props?: Props, url?: string, pageContext?: PageContext): Promise<void> {
    const payload: UmamiPayload = {
      website: this.config.websiteId,
      hostname: window.location.hostname,
      language: pageContext?.language,
      screen: getSize(pageContext?.screenSize, pageContext?.viewportSize),
      title: pageContext?.title,
      url: url || pageContext?.url,
      referrer: pageContext?.referrer,
      name,
      data: props,
    };
    
    await this.send('event', payload);
  }
  
  /**
   * Send pageview to Umami
   */
  async sendPageview(url?: string, pageContext?: PageContext): Promise<void> {
    const payload: UmamiPayload = {
      website: this.config.websiteId,
      hostname: window.location.hostname,
      language: pageContext?.language,
      screen: getSize(pageContext?.screenSize, pageContext?.viewportSize),
      title: pageContext?.title,
      url: url || pageContext?.url,
      referrer: pageContext?.referrer,
    };
    
    await this.send('pageview', payload);
  }
  
  /**
   * Check Umami-specific tracking conditions
   */
  // private shouldTrackUmami(): boolean {
  //   console.warn('[DEBUG] isDoNotTrackEnabled', isDoNotTrackEnabled());
  //   // Check if Do Not Track is enabled
  //   // Check Do Not Track
  //   if (this.config.doNotTrack && isDoNotTrackEnabled()) {
  //     return false;
  //   }
    
  //   // Check domain whitelist
  //   if (!isDomainAllowed(this.config.domains)) {
  //     return false;
  //   }
    
  //   return true;
  // }
  
  /**
   * Send data to Umami API
   */
  private async send(type: 'pageview' | 'event', payload: UmamiPayload): Promise<void> {
    debugLog('Sending Umami event', { type, payload }, this.config);
    const endpoint = this.getEndpoint();
    const cacheParam = this.config.cache ? `?cache=${Date.now()}` : '';
    const url = `${endpoint}/api/send${cacheParam}`;
    debugLog('Umami API URL', url);
    
    await this.transport.send(url, { payload, type }, {
      method: 'POST',
      headers: {
        'User-Agent': 'Trackkit/1.0',
      },
    });
  }
  
  /**
   * Get API endpoint
   */
  private getEndpoint(): string {
    return this.config.hostUrl.replace(/\/$/, '');
  }
}