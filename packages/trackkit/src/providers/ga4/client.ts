// src/providers/ga4/client.ts
import type { GA4Config, GA4EventParams } from './types';
import { logger } from '../../util/logger';
import { AnalyticsError } from '../../errors';

/**
 * GA4 client ID management
 */
class ClientIdManager {
  private static KEY = '_ga_cid';
  
  static get(): string {
    if (typeof window === 'undefined') return '';
    
    // Try to get existing client ID
    let clientId = this.getFromCookie() || this.getFromStorage();
    
    if (!clientId) {
      // Generate new client ID (GA4 format)
      clientId = `${Date.now()}.${Math.random().toString(36).substring(2, 15)}`;
      this.save(clientId);
    }
    
    return clientId;
  }
  
  private static getFromCookie(): string | null {
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
      // Fallback to cookie
      document.cookie = `_ga_cid=${clientId}; max-age=${60 * 60 * 24 * 365 * 2}`;
    }
  }
}

/**
 * Session management for GA4
 */
class SessionManager {
  private static KEY = '_ga_session';
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
    const id = Date.now().toString(36);
    try {
      sessionStorage.setItem(SessionManager.KEY, JSON.stringify({
        id,
        timestamp: Date.now(),
      }));
    } catch {
      // Session storage not available
    }
    return id;
  }
}

/**
 * GA4 Measurement Protocol client
 */
export class GA4Client {
  private config: Required<GA4Config>;
  private clientId: string;
  private sessionManager: SessionManager;
  private userId?: string;
  
  constructor(config: GA4Config) {
    this.config = {
      debug: false,
      sessionTimeout: 30,
      enhancedMeasurement: true,
      customDimensions: {},
      customMetrics: {},
      transport: 'beacon',
      apiSecret: '',
      ...config,
    };
    
    this.clientId = ClientIdManager.get();
    this.sessionManager = new SessionManager(this.config.sessionTimeout);
  }
  
  /**
   * Send event via Measurement Protocol
   */
  async sendEvent(eventName: string, params: GA4EventParams = {}): Promise<void> {
    const endpoint = this.config.debug
      ? 'https://www.google-analytics.com/debug/mp/collect'
      : 'https://www.google-analytics.com/mp/collect';
    
    const payload = {
      client_id: this.clientId,
      user_id: this.userId,
      events: [{
        name: eventName,
        params: {
          session_id: this.sessionManager.getSessionId(),
          engagement_time_msec: 100, // Required parameter
          ...this.getDefaultParams(),
          ...this.mapCustomDimensions(params),
          ...params,
        },
      }],
    };
    
    const url = new URL(endpoint);
    url.searchParams.append('measurement_id', this.config.measurementId);
    if (this.config.apiSecret) {
      url.searchParams.append('api_secret', this.config.apiSecret);
    }
    
    logger.debug('Sending GA4 event', {
      eventName,
      endpoint: url.toString(),
      payload,
    });
    
    try {
      await this.transport(url.toString(), payload);
      
      if (this.config.debug) {
        // Check validation messages in debug mode
        const response = await fetch(url.toString(), {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (result.validationMessages?.length > 0) {
          logger.warn('GA4 validation messages:', result.validationMessages);
        }
      }
    } catch (error) {
      throw new AnalyticsError(
        'Failed to send GA4 event',
        'NETWORK_ERROR',
        'ga4',
        error
      );
    }
  }
  
  /**
   * Send pageview event
   */
  async sendPageview(url?: string, title?: string): Promise<void> {
    await this.sendEvent('page_view', {
      page_location: url || window.location.href,
      page_title: title || document.title,
      page_referrer: document.referrer,
    });
  }
  
  /**
   * Set user ID
   */
  setUserId(userId: string | null): void {
    this.userId = userId || undefined;
  }
  
  /**
   * Get default parameters
   */
  private getDefaultParams(): GA4EventParams {
    if (typeof window === 'undefined') return {};
    
    return {
      page_location: window.location.href,
      page_referrer: document.referrer,
      page_title: document.title,
      screen_resolution: `${screen.width}x${screen.height}`,
      language: navigator.language,
    };
  }
  
  /**
   * Map custom dimensions
   */
  private mapCustomDimensions(params: any): any {
    const mapped: any = {};
    
    Object.entries(this.config.customDimensions).forEach(([key, dimension]) => {
      if (params[key] !== undefined) {
        mapped[dimension] = params[key];
        delete params[key];
      }
    });
    
    return mapped;
  }
  
  /**
   * Transport mechanism
   */
  private async transport(url: string, payload: any): Promise<void> {
    const body = JSON.stringify(payload);
    
    switch (this.config.transport) {
      case 'beacon':
        if (navigator.sendBeacon) {
          const blob = new Blob([body], { type: 'application/json' });
          const sent = navigator.sendBeacon(url, blob);
          if (!sent) {
            // Fallback to fetch
            await this.fetchTransport(url, body);
          }
          return;
        }
        // Fallback to fetch if beacon not available
        
      case 'fetch':
        await this.fetchTransport(url, body);
        return;
        
      case 'xhr':
        await this.xhrTransport(url, body);
        return;
    }
  }
  
  private async fetchTransport(url: string, body: string): Promise<void> {
    await fetch(url, {
      method: 'POST',
      body,
      keepalive: true,
    });
  }
  
  private xhrTransport(url: string, body: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.onload = () => resolve();
      xhr.onerror = () => reject(new Error('XHR failed'));
      xhr.send(body);
    });
  }
}