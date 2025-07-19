import type { BrowserData, UmamiConfig } from './types';

/**
 * Check if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.document !== 'undefined';
}

/**
 * Check if Do Not Track is enabled
 */
export function isDoNotTrackEnabled(): boolean {
  if (!isBrowser()) return false;
  
  const { doNotTrack, navigator } = window as any;
  const dnt = doNotTrack || 
    navigator.doNotTrack || 
    navigator.msDoNotTrack;
    
  return dnt === '1' || dnt === 'yes';
}

/**
 * Check if current domain should be tracked
 */
export function shouldTrackDomain(domains?: string[]): boolean {
  if (!domains || domains.length === 0) return true;
  if (!isBrowser()) return false;
  
  const hostname = window.location.hostname;
  return domains.some(domain => {
    // Support wildcard domains
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(2);
      return hostname.endsWith(suffix);
    }
    return hostname === domain;
  });
}

/**
 * Collect browser environment data
 */
export function getBrowserData(): BrowserData {
  if (!isBrowser()) {
    return {
      screen: '',
      language: '',
      title: '',
      url: '',
      referrer: '',
    };
  }
  
  const { screen, navigator, location, document } = window;
  
  return {
    screen: `${screen.width}x${screen.height}`,
    language: navigator.language,
    title: document.title,
    url: location.pathname + location.search,
    referrer: document.referrer,
  };
}

/**
 * Generate cache buster parameter
 */
export function getCache(cache?: boolean): string {
  return cache ? `?cache=${Date.now()}` : '';
}

/**
 * Format API endpoint
 */
export function getApiEndpoint(hostUrl: string, path: string, cache?: boolean): string {
  const base = hostUrl.replace(/\/$/, '');
  const cacheParam = getCache(cache);
  return `${base}${path}${cacheParam}`;
}

/**
 * Create fetch options with proper headers
 */
export function getFetchOptions(payload: any): RequestInit {
  return {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'Trackkit/1.0',
    },
    body: JSON.stringify(payload),
    keepalive: true, // Allow requests to complete after page unload
  };
}

/**
 * Parse website ID from various formats
 */
export function parseWebsiteId(siteId?: string): string | null {
  if (!siteId) return null;
  
  // Handle Umami script data attributes format
  if (siteId.startsWith('data-website-id=')) {
    return siteId.replace('data-website-id=', '');
  }
  
  // Validate UUID format (loose check)
  const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
  if (uuidRegex.test(siteId.replace(/-/g, ''))) {
    return siteId;
  }
  
  return siteId;
}