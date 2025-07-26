import type { GA4Config, GA4EventParams, GA4ClientConfig } from './types';
import type { Props } from '../../types';
import { BaseClient } from '../shared/base-client';
import { Transport, TransportMethod } from '../shared/transport';
import { getScreenResolution, safeStringify } from '../shared/browser';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * GA4 client ID management
 */
class ClientIdManager {
  private static KEY = '_trackkit_ga_cid';
  
  static get(): string {
    if (typeof window === 'undefined') return '';
    
    // Try to get existing client ID
    let clientId = this.getFromStorage() || this.getFromGACookie();
    
    if (!clientId) {
      // Generate new client ID (GA4 format)
      clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
      this.save(clientId);
    }
    
    return clientId;
  }
  
  private static getFromGACookie(): string | null {
    if (typeof document === 'undefined') return null;
    
    // Try to find existing GA cookie
    const match = document.cookie.match(/_ga=GA\d\.\d\.(\d+\.\d+)/);
    return match ? match[1] : null;
  }
  
  private static getFromStorage(): string | null {
    try {
      return localStorage.getItem(this.KEY);
    } catch {
      return null;
    }
  }
  
  private static save(clientId: string): void {
    try {
      localStorage.setItem(this.KEY, clientId);
    } catch {
      // Storage not available
    }
  }
}

/**
 * Session management for GA4
 */
class SessionManager {
  private static KEY = '_trackkit_ga_session';
  private sessionTimeout: number;
  private sessionId: string;
  private lastActivity: number;
  
  constructor(timeoutMinutes = 30) {
    this.sessionTimeout = timeoutMinutes * 60 * 1000;
    this.sessionId = this.getOrCreateSession();
    this.lastActivity = Date.now();
  }
  
  getSessionId(): string {
    // Check if session expired
    if (Date.now() - this.lastActivity > this.sessionTimeout) {
      this.sessionId = this.createNewSession();
    }
    
    this.lastActivity = Date.now();
    this.updateStorage();
    
    return this.sessionId;
  }
  
  private getOrCreateSession(): string {
    try {
      const stored = sessionStorage.getItem(SessionManager.KEY);
      if (stored) {
        const { id, timestamp } = JSON.parse(stored);
        if (Date.now() - timestamp < this.sessionTimeout) {
          return id;
        }
      }
    } catch {
      // Ignore errors
    }
    
    return this.createNewSession();
  }
  
  private createNewSession(): string {
    return Date.now().toString(36) + Math.random().toString(36).substring(2, 7);
  }
  
  private updateStorage(): void {
    try {
      sessionStorage.setItem(SessionManager.KEY, JSON.stringify({
        id: this.sessionId,
        timestamp: this.lastActivity,
      }));
    } catch {
      // Session storage not available
    }
  }
}

/**
 * GA4-specific client implementation
 */
export class GA4Client extends BaseClient<GA4ClientConfig> {
  private clientId: string;
  private sessionManager: SessionManager;
  private userId?: string;
  
  constructor(config: GA4Config) {
    const fullConfig: GA4ClientConfig = {
      measurementId: config.measurementId,
      debug: config.debug ?? false,
      apiSecret: config.apiSecret || '',
      sessionTimeout: config.sessionTimeout ?? 30,
      customDimensions: config.customDimensions || {},
      customMetrics: config.customMetrics || {},
      transport: config.transport || 'beacon',
      onError: config.onError,
    };
    
    super(fullConfig, true); // Allow tracking when page is hidden for GA4
    
    this.clientId = ClientIdManager.get();
    this.sessionManager = new SessionManager(fullConfig.sessionTimeout);
  }
  
  /**
   * Send event to GA4
   */
  async sendEvent(name: string, props?: Props, url?: string): Promise<void> {
    if (!this.shouldTrack()) return;
    
    const ga4Params = this.buildEventParams(props, url);
    const payload = this.buildPayload(name, ga4Params);
    
    await this.send(payload);
  }
  
  /**
   * Send pageview to GA4
   */
  async sendPageview(url?: string, title?: string): Promise<void> {
    const params: GA4EventParams = {
      page_location: url || window.location.href,
      page_title: title || this.browserData.title,
      page_referrer: this.browserData.referrer,
    };
    
    await this.sendEvent('page_view', params);
  }
  
  /**
   * Set user ID
   */
  setUserId(userId: string | null): void {
    this.userId = userId || undefined;
  }
  
  /**
   * Create custom transport for GA4
   */
  protected createTransport(): Transport {
    // GA4 Measurement Protocol doesn't support beacon with response validation
    const method: TransportMethod = 
      this.config.transport === 'beacon' && !this.config.debug 
        ? 'beacon' 
        : 'fetch';
        
    return new Transport(method);
  }
  
  /**
   * Build GA4 event parameters
   */
  private buildEventParams(props?: Props, url?: string): GA4EventParams {
    const params: GA4EventParams = {
      // Session info
      session_id: this.sessionManager.getSessionId(),
      engagement_time_msec: 100, // Required by GA4
      
      // Page info
      page_location: url || window.location.href,
      page_referrer: this.browserData.referrer,
      page_title: this.browserData.title,
      
      // Device info
      screen_resolution: getScreenResolution(),
      language: this.browserData.language,
    };
    
    // Add custom dimensions/metrics
    if (props) {
      const processed = this.processCustomDimensions(props);
      Object.assign(params, processed);
    }
    
    return params;
  }
  
  /**
   * Process custom dimensions and metrics
   */
  private processCustomDimensions(props: Props): Props {
    const processed: Props = {};
    
    Object.entries(props).forEach(([key, value]) => {
      // Check if it's a custom dimension
      if (this.config.customDimensions[key]) {
        processed[this.config.customDimensions[key]] = value;
      }
      // Check if it's a custom metric
      else if (this.config.customMetrics[key]) {
        processed[this.config.customMetrics[key]] = value;
      }
      // Standard property
      else {
        processed[key] = value;
      }
    });
    
    return processed;
  }
  
  /**
   * Build GA4 Measurement Protocol payload
   */
  private buildPayload(eventName: string, params: GA4EventParams): any {
    return {
      client_id: this.clientId,
      user_id: this.userId,
      timestamp_micros: Date.now() * 1000, // Convert to microseconds
      non_personalized_ads: false,
      events: [{
        name: this.mapEventName(eventName),
        params: params,
      }],
    };
  }
  
  /**
   * Map event names to GA4 standard events
   */
  private mapEventName(name: string): string {
    const standardEvents: Record<string, string> = {
      // Ecommerce
      'add_to_cart': 'add_to_cart',
      'remove_from_cart': 'remove_from_cart',
      'view_item': 'view_item',
      'view_cart': 'view_cart',
      'begin_checkout': 'begin_checkout',
      'purchase': 'purchase',
      'refund': 'refund',
      
      // Engagement
      'login': 'login',
      'sign_up': 'sign_up',
      'search': 'search',
      'share': 'share',
      'select_content': 'select_content',
      
      // Default
      'click': 'click',
      'scroll': 'scroll',
      'view_search_results': 'view_search_results',
    };
    
    return standardEvents[name.toLowerCase()] || name;
  }
  
  /**
   * Send data to GA4 Measurement Protocol
   */
  private async send(payload: any): Promise<void> {
    const endpoint = this.config.debug
      ? 'https://www.google-analytics.com/debug/mp/collect'
      : 'https://www.google-analytics.com/mp/collect';
    
    const url = new URL(endpoint);
    url.searchParams.append('measurement_id', this.config.measurementId);
    
    if (this.config.apiSecret) {
      url.searchParams.append('api_secret', this.config.apiSecret);
    }
    
    this.debug('Sending GA4 event', { url: url.toString(), payload });
    
    try {
      await this.transport.send(url.toString(), payload);
      
      // In debug mode, make a second request to get validation messages
      if (this.config.debug) {
        try {
          const debugResponse = await fetch(url.toString(), {
            method: 'POST',
            body: safeStringify(payload),
          });
          
          if (debugResponse.ok) {
            const result = await debugResponse.json();
            if (result.validationMessages?.length > 0) {
              logger.warn('GA4 validation messages:', result.validationMessages);
            }
          }
        } catch (debugError) {
          // Debug validation is optional, don't fail
          logger.debug('Could not fetch debug validation', debugError);
        }
      }
      
      this.debug('GA4 event sent successfully');
    } catch (error) {
      const analyticsError = error instanceof AnalyticsError
        ? error
        : new AnalyticsError(
            'Failed to send GA4 event',
            'NETWORK_ERROR',
            'ga4',
            error
          );
          
      this.handleError(analyticsError, 'GA4 event');
      throw analyticsError;
    }
  }
}