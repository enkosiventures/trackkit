// src/providers/plausible/client.ts
import type { PlausibleConfig, PlausibleEvent } from './types';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * Get page data for Plausible
 */
function getPageData(hashMode: boolean): { url: string; referrer: string } {
  if (typeof window === 'undefined') {
    return { url: '', referrer: '' };
  }
  
  const url = hashMode 
    ? window.location.href
    : window.location.href.replace(/#.*$/, '');
    
  return {
    url,
    referrer: document.referrer || '',
  };
}

/**
 * Check if URL should be excluded
 */
function isExcluded(url: string, excludePatterns?: string[]): boolean {
  if (!excludePatterns || excludePatterns.length === 0) return false;
  
  return excludePatterns.some(pattern => {
    // Support wildcards
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return regex.test(url);
  });
}

/**
 * Plausible tracker client
 */
export class PlausibleClient {
  private config: Required<PlausibleConfig>;
  private lastPageview?: string;
  
  constructor(config: PlausibleConfig) {
    this.config = {
      apiHost: 'https://plausible.io',
      eventEndpoint: '/api/event',
      trackLocalhost: false,
      hashMode: false,
      exclude: [],
      defaultProps: {},
      revenue: {
        currency: 'USD',
        trackingEnabled: false,
      },
      ...config,
    };
  }
  
  /**
   * Check if tracking should occur
   */
  private shouldTrack(url: string): boolean {
    // Check localhost
    if (!this.config.trackLocalhost && typeof window !== 'undefined') {
      const hostname = window.location.hostname;
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '') {
        logger.debug('Plausible: localhost tracking disabled');
        return false;
      }
    }
    
    // Check exclusions
    if (isExcluded(url, this.config.exclude)) {
      logger.debug('Plausible: URL excluded from tracking', { url });
      return false;
    }
    
    return true;
  }
  
  /**
   * Send event to Plausible
   */
  async sendEvent(
    eventName: string,
    options: {
      url?: string;
      props?: Record<string, string | number>;
      revenue?: number;
      currency?: string;
    } = {}
  ): Promise<void> {
    const pageData = getPageData(this.config.hashMode);
    const url = options.url || pageData.url;
    
    if (!this.shouldTrack(url)) {
      console.warn("Event has url marked 'should not track'", url);
      logger.warn("Event has url marked 'should not track'", url);
      return;
    }
    
    // Build event payload
    const payload: PlausibleEvent = {
      n: eventName,
      u: url,
      d: this.config.domain,
      r: pageData.referrer,
      w: window.innerWidth,
    };
    
    if (this.config.hashMode) {
      payload.h = 1;
    }
    
    // Add custom properties
    const props = {
      ...this.config.defaultProps,
      ...options.props,
    };
    
    if (Object.keys(props).length > 0) {
      payload.m = props;
    }
    
    // Add revenue tracking
    if (options.revenue && this.config.revenue.trackingEnabled) {
      payload.$ = Math.round(options.revenue * 100); // Convert to cents
      payload.$$ = options.currency || this.config.revenue.currency;
    }
    
    // Send request
    const endpoint = `${this.config.apiHost}${this.config.eventEndpoint}`;
    
    logger.debug('Sending Plausible event', {
      endpoint,
      eventName,
      payload,
    });
    
    try {
      console.warn("[PLAUSIBLE] performing event fetch", payload);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Forwarded-For': '127.0.0.1', // Required header
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new AnalyticsError(
          `Plausible error: ${error}`,
          'NETWORK_ERROR',
          'plausible'
        );
      }
      
      logger.debug('Plausible event sent successfully');
      
    } catch (error) {
      if (error instanceof AnalyticsError) {
        throw error;
      }
      
      throw new AnalyticsError(
        'Failed to send Plausible event',
        'NETWORK_ERROR',
        'plausible',
        error
      );
    }
  }
  
  /**
   * Track pageview
   */
  async trackPageview(url?: string): Promise<void> {
    const pageUrl = url || getPageData(this.config.hashMode).url;
    
    // Deduplicate repeated pageviews
    if (pageUrl === this.lastPageview) {
      logger.debug('Plausible: Duplicate pageview ignored', { url: pageUrl });
      return;
    }
    
    this.lastPageview = pageUrl;
    await this.sendEvent('pageview', { url: pageUrl });
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
    await this.sendEvent(goalName, options);
  }
  
  /**
   * Track 404 errors
   */
  async track404(url?: string): Promise<void> {
    await this.sendEvent('404', { 
      url,
      props: { path: window.location.pathname },
    });
  }
  
  /**
   * Track file downloads
   */
  async trackDownload(fileName: string, url?: string): Promise<void> {
    await this.sendEvent('File Download', {
      url,
      props: { file: fileName },
    });
  }
  
  /**
   * Track outbound links
   */
  async trackOutbound(linkUrl: string, currentUrl?: string): Promise<void> {
    await this.sendEvent('Outbound Link: Click', {
      url: currentUrl,
      props: { url: linkUrl },
    });
  }
}

/**
 * Auto-track enhancements for Plausible
 */
export function enableAutoTracking(client: PlausibleClient): void {
  if (typeof window === 'undefined') return;
  
  // Track outbound links
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link) return;
    
    const href = link.href;
    if (!href) return;
    
    try {
      const url = new URL(href);
      if (url.host !== window.location.host) {
        client.trackOutbound(href).catch(error => {
          logger.error('Failed to track outbound link', error);
        });
      }
    } catch {
      // Invalid URL
    }
  });
  
  // Track file downloads
  const downloadExtensions = [
    'pdf', 'xlsx', 'xls', 'csv', 'docx', 'doc',
    'ppt', 'pptx', 'zip', 'rar', 'tar', 'gz',
  ];
  
  document.addEventListener('click', (event) => {
    const link = (event.target as HTMLElement).closest('a');
    if (!link?.href) return;
    
    const extension = link.href.split('.').pop()?.toLowerCase();
    if (extension && downloadExtensions.includes(extension)) {
      const fileName = link.href.split('/').pop() || 'unknown';
      client.trackDownload(fileName).catch(error => {
        logger.error('Failed to track download', error);
      });
    }
  });
  
  // Track 404 errors
  if (document.title.toLowerCase().includes('404') || 
      document.body.textContent?.toLowerCase().includes('page not found')) {
    client.track404().catch(error => {
      logger.error('Failed to track 404', error);
    });
  }
}