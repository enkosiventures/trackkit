import type { TransportOptions } from './types';
import { isBrowser, safeStringify } from './browser';
import { debugLog, logger } from '../../util/logger';
import { AnalyticsError, dispatchError } from '../../errors';

/**
 * Transport methods available
 */
export type TransportMethod = 'beacon' | 'fetch' | 'xhr';

/**
 * HTTP transport for analytics requests
 */
export class Transport {
  private method: TransportMethod;
  private timeout: number;
  
  constructor(method: TransportMethod = 'beacon', timeout = 5000) {
    this.method = method;
    this.timeout = timeout;
  }
  
  /**
   * Send data to an endpoint
   */
  async send(
    url: string, 
    data?: any,
    options: TransportOptions = {}
  ): Promise<void> {
    if (!isBrowser()) {
      throw new AnalyticsError(
        'Transport requires browser environment',
        'INVALID_ENVIRONMENT',
      );
    }
    
    const { 
      method = 'POST',
      headers = {},
      keepalive = true,
    } = options;
    
    debugLog('Transport.send', { url, method: this.method, data });
    
    try {
      switch (this.method) {
        case 'beacon':
          debugLog('Transport sending with beacon');
          logger.info('Transport sending with beacon');
          // @ts-expect-error
          if (method === 'POST' && navigator.sendBeacon) {
            const success = await this.sendBeacon(url, data, headers);
            if (success) return;
          }
          // Fallback to fetch if beacon fails or not available
          await this.sendFetch(url, data, { ...options, keepalive });
          break;
          
        case 'fetch':
          debugLog('Transport sending with fetch');
          logger.info('Transport sending with fetch');
          await this.sendFetch(url, data, { ...options, keepalive });
          break;
          
        case 'xhr':
          debugLog('Transport sending with xhr');
          logger.info('Transport sending with xhr');
          await this.sendXHR(url, data, options);
          break;
          
        default:
          throw new AnalyticsError(
            `Unknown transport method: ${this.method}`,
            'INVALID_CONFIG'
          );
      }
    } catch (error) {
      if (error instanceof AnalyticsError) {
        throw error;
      }
      
      throw new AnalyticsError(
        'Transport request failed',
        'NETWORK_ERROR',
        undefined,
        error
      );
    }
  }
  
  /**
   * Send using Beacon API
   */
  private async sendBeacon(
    url: string,
    data: any,
    headers: Record<string, string>
  ): Promise<boolean> {
    if (!navigator.sendBeacon) return false;
    
    try {
      let body: BodyInit;
      
      if (data === undefined || data === null) {
        body = new Blob();
      } else if (typeof data === 'string') {
        body = new Blob([data], { type: headers['Content-Type'] || 'text/plain' });
      } else {
        const json = safeStringify(data);
        body = new Blob([json], { type: 'application/json' });
      }
      
      const success = navigator.sendBeacon(url, body);
      
      if (!success) {
        logger.debug('Beacon API failed, will fallback to fetch');
      }
      
      return success;
    } catch (error) {
      logger.debug('Beacon API error', error);
      return false;
    }
  }
  
  /**
   * Send using Fetch API
   */
  private async sendFetch(
    url: string,
    data: any,
    options: TransportOptions
  ): Promise<void> {
    const { 
      method = 'POST',
      headers = {},
      keepalive = true,
    } = options;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    
    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        keepalive,
        signal: controller.signal,
      };
      
      // Add body for POST requests
      if (method === 'POST' && data !== undefined) {
        fetchOptions.body = typeof data === 'string' 
          ? data 
          : safeStringify(data);
      }
      
      const response = await fetch(url, fetchOptions);
      
      if (!response.ok) {
        throw new AnalyticsError(
          `HTTP ${response.status}: ${response.statusText}`,
          'NETWORK_ERROR'
        );
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Send using XMLHttpRequest
   */
  private sendXHR(
    url: string,
    data: any,
    options: TransportOptions
  ): Promise<void> {
    const { 
      method = 'POST',
      headers = {},
    } = options;
    
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      
      xhr.open(method, url, true);
      
      // Set headers
      xhr.setRequestHeader('Content-Type', 'application/json');
      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });
      
      // Set timeout
      xhr.timeout = this.timeout;
      
      // Handle response
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve();
        } else {
          reject(new AnalyticsError(
            `HTTP ${xhr.status}: ${xhr.statusText}`,
            'NETWORK_ERROR'
          ));
        }
      };
      
      // Handle errors
      xhr.onerror = () => {
        reject(new AnalyticsError('Network request failed', 'NETWORK_ERROR'));
      };
      
      xhr.ontimeout = () => {
        reject(new AnalyticsError('Request timeout', 'NETWORK_ERROR'));
      };
      
      // Send request
      const body = method === 'POST' && data !== undefined
        ? (typeof data === 'string' ? data : safeStringify(data))
        : null;
        
      xhr.send(body);
    });
  }
}

/**
 * Create a transport instance with sensible defaults
 */
export function createTransport(
  preferredMethod?: TransportMethod,
  options: { timeout?: number } = {}
): Transport {
  // Determine best available method
  let method: TransportMethod = preferredMethod || 'beacon';
  
  if (method === 'beacon' && !navigator.sendBeacon) {
    logger.debug('Beacon API not available, using fetch');
    method = 'fetch';
  }
  
  return new Transport(method, options.timeout);
}