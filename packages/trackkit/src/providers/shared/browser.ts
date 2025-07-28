// import type { BrowserData } from './types';

import { PageContext } from "../../types";

/**
 * Check if code is running in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.document !== 'undefined' &&
         typeof window.navigator !== 'undefined';
}

/**
 * Get current browser data
 */
// export function getBrowserData(): BrowserData {
//   if (!isBrowser()) {
//     return {
//       url: '',
//       referrer: '',
//       title: '',
//       viewport: { width: 0, height: 0 },
//       screen: { width: 0, height: 0 },
//       language: '',
//     };
//   }
  
//   return {
//     url: window.location.pathname + window.location.search,
//     referrer: document.referrer || '',
//     title: document.title || '',
//     viewport: {
//       width: window.innerWidth || 0,
//       height: window.innerHeight || 0,
//     },
//     screen: {
//       width: window.screen?.width || 0,
//       height: window.screen?.height || 0,
//     },
//     language: navigator.language || 'en',
//   };
// }

export function getDocumentTitle(): string { return document.title || ''; }
export function getInitialReferrer(): string { return document.referrer || ''; }
export function getViewportSize(): { width: number; height: number } { return { width: window.innerWidth || 0, height: window.innerHeight || 0 }; }
export function getScreenSize(): { width: number; height: number } { return { width: window.screen?.width || 0, height: window.screen?.height || 0 }; }
export function getLanguage(): string { return navigator.language || 'en'; }

export function getPageContext(): PageContext {
  return {
    url: getPageUrl(),
    title: getDocumentTitle(),
    referrer: getInitialReferrer(),
    viewportSize: getViewportSize(),
    screenSize: getScreenSize(),
    language: getLanguage(),
    timestamp: Date.now(),
  };
}

/**
 * Get full page URL
 */
export function getPageUrl(includeHash = false): string {
  if (!isBrowser()) return '';
  
  const url = window.location.href;
  return includeHash ? url : url.replace(/#.*$/, '');
}

/**
 * Parse URL to get clean pathname
 */
export function getPathname(url?: string): string {
  if (!url && isBrowser()) {
    return window.location.pathname;
  }
  
  try {
    const parsed = new URL(url || '', window.location.origin);
    return parsed.pathname;
  } catch {
    return url || '';
  }
}

/**
 * Check if Do Not Track is enabled
 */
export function isDoNotTrackEnabled(): boolean {
  if (!isBrowser()) return false;
  
  const dnt = 
    (window as any).doNotTrack || 
    navigator.doNotTrack || 
    (navigator as any).msDoNotTrack;
    
  return dnt === '1' || dnt === 'yes' || dnt === true;
}

/**
 * Check if current domain matches allowed domains
 */
export function isDomainAllowed(allowedDomains?: string[]): boolean {
  if (!allowedDomains || allowedDomains.length === 0) return true;
  if (!isBrowser()) return false;
  
  const hostname = window.location.hostname;
  
  return allowedDomains.some(domain => {
    // Support wildcards: *.example.com
    if (domain.startsWith('*.')) {
      const suffix = domain.slice(2);
      return hostname === suffix || hostname.endsWith('.' + suffix);
    }
    
    // Support wildcards: example.*
    if (domain.endsWith('.*')) {
      const prefix = domain.slice(0, -2);
      return hostname === prefix || hostname.startsWith(prefix + '.');
    }
    
    // Exact match
    return hostname === domain;
  });
}

/**
 * Check if URL matches exclusion patterns
 */
export function isUrlExcluded(url: string, excludePatterns?: string[]): boolean {
  if (!excludePatterns || excludePatterns.length === 0) return false;
  
  return excludePatterns.some(pattern => {
    // Convert wildcard pattern to regex
    const regexPattern = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&') // Escape special chars
      .replace(/\*/g, '.*'); // Convert * to .*
      
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(url);
  });
}

/**
 * Check if running on localhost
 */
export function isLocalhost(): boolean {
  if (!isBrowser()) return false;
  
  const hostname = window.location.hostname;
  return hostname === 'localhost' || 
         hostname === '127.0.0.1' || 
         hostname === '0.0.0.0' ||
         hostname === '' ||
         hostname === '[::1]'; // IPv6 localhost
}

/**
 * Get document visibility state
 */
export function isPageHidden(): boolean {
  if (!isBrowser()) return false;
  return document.hidden || false;
}

/**
 * Format screen resolution string
 */
export function getScreenResolution(): string {
  if (!isBrowser()) return '';
  return `${window.screen?.width || 0}x${window.screen?.height || 0}`;
}

/**
 * Safe JSON stringify that handles circular references
 */
export function safeStringify(obj: any): string {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) {
        return '[Circular]';
      }
      seen.add(value);
    }
    return value;
  });
}