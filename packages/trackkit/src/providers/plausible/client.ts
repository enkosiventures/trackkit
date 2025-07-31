import type { PlausibleConfig, PlausibleEvent } from './types';
import type { PageContext, Props } from '../../types';
import { BaseClient } from '../shared/base-client';
import { 
  getPageUrl,
  isUrlExcluded,
  isLocalhost,
} from '../shared/browser';
import { debugLog, logger } from '../../util/logger';

/**
 * Plausible-specific client implementation
 * The facade handles consent, error management, and debug logging
 */
export class PlausibleClient extends BaseClient<Required<PlausibleConfig>> {
  private lastPageview?: string;
  
  constructor(config: PlausibleConfig) {
    const fullConfig: Required<PlausibleConfig> = {
      domain: config.domain,
      apiHost: config.apiHost || 'https://plausible.io',
      eventEndpoint: config.eventEndpoint || '/api/event',
      trackLocalhost: config.trackLocalhost ?? false,
      hashMode: config.hashMode ?? false,
      exclude: config.exclude || [],
      defaultProps: config.defaultProps || {},
      revenue: {
        currency: 'USD',
        trackingEnabled: false,
        ...config.revenue,
      },
      onError: config.onError ?? ((error) => { logger.error(error)}),
    };
    
    super(fullConfig, false); // Don't allow tracking when page is hidden
  }
  
  /**
   * Send event to Plausible
   */
  async sendEvent(name: string, props?: Props, url?: string, pageContext?: PageContext): Promise<void> {
    debugLog('PlausibleClient: sendEvent', { name, props, url, pageContext });
    if (!this.shouldTrack()) return;
    
    debugLog('PlausibleClient: tracking enabled');
    const pageUrl = url || getPageUrl(this.config.hashMode);
    
    // Additional Plausible-specific checks
    if (!this.shouldTrackPlausible(pageUrl)) return;
    debugLog('PlausibleClient: tracking conditions met', { pageUrl, props });

    // Build Plausible event payload
    const payload = this.buildPayload(name, pageUrl, props, pageContext);
    
    debugLog('Sending Plausible event', { payload });
    await this.send(payload);
  }
  
  /**
   * Send pageview to Plausible
   */
  async sendPageview(url?: string, pageContext?: PageContext): Promise<void> {
    const pageUrl = url || getPageUrl(this.config.hashMode);
    
    // Deduplicate repeated pageviews
    if (pageUrl === this.lastPageview) {
      return;
    }
    
    this.lastPageview = pageUrl;
    debugLog('Sending pageview', { url: pageUrl, pageContext });
    await this.sendEvent('pageview', undefined, pageUrl, pageContext);
  }
  
  /**
   * Track custom goal
   */
  async trackGoal(
    goalName: string,
    options?: {
      props?: Record<string, string | number>;
      revenue?: number;
      currency?: string;
    }
  ): Promise<void> {
    await this.sendEvent(goalName, options?.props);
  }
  
  /**
   * Check Plausible-specific tracking conditions
   */
  private shouldTrackPlausible(url: string): boolean {
    // Check localhost
    if (!this.config.trackLocalhost && isLocalhost()) {
      return false;
    }
    
    // Check exclusions
    if (isUrlExcluded(url, this.config.exclude)) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Build Plausible event payload
   */
  private buildPayload(
    eventName: string,
    url: string,
    props?: Props,
    pageContext?: PageContext,
  ): PlausibleEvent {
    const payload: PlausibleEvent = {
      name: eventName,
      url,
      domain: this.config.domain,
      referrer: pageContext?.referrer || '',
    };
    
    if (this.config.hashMode) {
      payload.hashMode = 1;
    }
    
    // Process props
    const processedProps = this.processProps(props);
    if (processedProps && Object.keys(processedProps).length > 0) {
      payload.props = processedProps;
    }
    
    // Handle revenue tracking
    if (props?.revenue && this.config.revenue.trackingEnabled) {
      payload.revenue = {
        amount: Math.round(Number(props.revenue) * 100), // Convert to cents
        currency: String(props.currency || this.config.revenue.currency),
      }
      
    }
    
    return payload;
  }
  
  /**
   * Process props to Plausible format (strings only)
   */
  private processProps(props?: Props): Record<string, string> | undefined {
    if (!props) return undefined;
    
    // Merge with default props
    const merged = { ...this.config.defaultProps };
    
    // Convert all values to strings and filter out revenue/currency
    Object.entries(props).forEach(([key, value]) => {
      if (key !== 'revenue' && key !== 'currency' && value != null) {
        merged[key] = String(value);
      }
    });
    
    return Object.keys(merged).length > 0 ? merged : undefined;
  }
  
  /**
   * Send data to Plausible API
   */
  private async send(payload: PlausibleEvent): Promise<void> {
    const url = `${this.config.apiHost}${this.config.eventEndpoint}`;
    
    await this.transport.send(url, payload, {
      method: 'POST',
      headers: {
        'X-Forwarded-For': '127.0.0.1', // Required by Plausible
      },
    });
  }
  
  /**
   * Auto-tracking: Track outbound links
   */
  trackOutboundLink(linkUrl: string): Promise<void> {
    return this.sendEvent('Outbound Link: Click', { url: linkUrl });
  }
  
  /**
   * Auto-tracking: Track file downloads
   */
  trackFileDownload(fileName: string): Promise<void> {
    return this.sendEvent('File Download', { file: fileName });
  }
  
  /**
   * Auto-tracking: Track 404 errors
   */
  track404(): Promise<void> {
    return this.sendEvent('404', { path: window.location.pathname });
  }
}