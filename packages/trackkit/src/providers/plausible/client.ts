import type { PlausibleConfig, PlausibleEvent } from './types';
import type { Props } from '../../types';
import { BaseClient } from '../shared/base-client';
import { 
  getPageUrl,
  isUrlExcluded,
  isLocalhost,
} from '../shared/browser';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Plausible-specific client implementation
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
    };
    
    super(fullConfig, false); // Don't allow tracking when page is hidden
  }
  
  /**
   * Send event to Plausible
   */
  async sendEvent(name: string, props?: Props, url?: string): Promise<void> {
    if (!this.shouldTrack()) return;
    
    const pageUrl = url || getPageUrl(this.config.hashMode);
    
    // Additional Plausible-specific checks
    if (!this.shouldTrackPlausible(pageUrl)) return;
    
    // Build Plausible event payload
    const payload = this.buildPayload(name, pageUrl, props);
    
    await this.send(payload);
  }
  
  /**
   * Send pageview to Plausible
   */
  async sendPageview(url?: string): Promise<void> {
    const pageUrl = url || getPageUrl(this.config.hashMode);
    
    // Deduplicate repeated pageviews
    if (pageUrl === this.lastPageview) {
      this.debug('Plausible: Duplicate pageview ignored', { url: pageUrl });
      return;
    }
    
    this.lastPageview = pageUrl;
    await this.sendEvent('pageview', undefined, pageUrl);
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
      this.debug('Plausible: localhost tracking disabled');
      return false;
    }
    
    // Check exclusions
    if (isUrlExcluded(url, this.config.exclude)) {
      this.debug('Plausible: URL excluded from tracking', { url });
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
    props?: Props
  ): PlausibleEvent {
    const payload: PlausibleEvent = {
      n: eventName,
      u: url,
      d: this.config.domain,
      r: this.browserData.referrer,
      w: this.browserData.viewport.width,
    };
    
    if (this.config.hashMode) {
      payload.h = 1;
    }
    
    // Process props
    const processedProps = this.processProps(props);
    if (processedProps && Object.keys(processedProps).length > 0) {
      payload.m = processedProps;
    }
    
    // Handle revenue tracking
    if (props?.revenue && this.config.revenue.trackingEnabled) {
      payload.$ = Math.round(Number(props.revenue) * 100); // Convert to cents
      payload.$$ = String(props.currency || this.config.revenue.currency);
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
    
    this.debug('Sending Plausible event', { url, payload });
    
    try {
      await this.transport.send(url, payload, {
        method: 'POST',
        headers: {
          'X-Forwarded-For': '127.0.0.1', // Required by Plausible
        },
      });
      
      this.debug('Plausible event sent successfully');
    } catch (error) {
      const analyticsError = error instanceof AnalyticsError
        ? error
        : new AnalyticsError(
            'Failed to send Plausible event',
            'NETWORK_ERROR',
            'plausible',
            error
          );
          
      this.handleError(analyticsError, 'Plausible event');
      throw analyticsError;
    }
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