import type { PageContext } from "../../types";
import { hasDOM } from "../../util/env";


export function getDocumentTitle(): string | undefined { return hasDOM() ? document.title : undefined; }
export function getInitialReferrer(): string | undefined { return hasDOM() ? document.referrer : undefined; }
// export function getViewportSize(): { width: number; height: number } { return isBrowser() ? { width: window.innerWidth || 0, height: window.innerHeight || 0 } : { width: 0, height: 0 }; }
// export function getScreenSize(): { width: number; height: number } { return isBrowser() ? { width: window.screen?.width || 0, height: window.screen?.height || 0 } : { width: 0, height: 0 }; }
// export function getLanguage(): string { return isBrowser() ? navigator.language || navigator.languages?.[0] || 'en' : 'en'; }
// export function getHostname(): string { return isBrowser() ? window.location.hostname || '' : ''; }

function getHostname(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try { return window.location.hostname || undefined; } catch { return undefined; }
}

function getLanguage(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;
  return navigator.language || (Array.isArray(navigator.languages) ? navigator.languages[0] : undefined) || undefined;
}

function getScreenSize(): { width: number; height: number } | undefined {
  if (typeof window === 'undefined' || !window.screen) return undefined;
  const { width, height } = window.screen;
  return { width, height };
}

function getViewportSize(): { width: number; height: number } | undefined {
  if (typeof window === 'undefined') return undefined;
  const w = Math.max(0, Number(window.innerWidth || 0));
  const h = Math.max(0, Number(window.innerHeight || 0));
  return { width: w, height: h };
}

/** Prefer screenSize; fall back to viewportSize; omit if invalid/zero. */
export function displaySizeFromContext(ctx: PageContext): string | undefined {
  const asStr = (w?: number, h?: number) =>
    w && h && w > 0 && h > 0 ? `${w}x${h}` : undefined;

  return (
    asStr(ctx.screenSize?.width, ctx.screenSize?.height) ??
    asStr(ctx.viewportSize?.width, ctx.viewportSize?.height)
  );
}

export function getPageContext(url?: string): PageContext {
  const viewport = getViewportSize();
  const screen = getScreenSize();

  return {
    url: url ?? getPageUrl(),
    title: getDocumentTitle(),
    referrer: getInitialReferrer(),
    viewportSize:
      viewport && viewport.width > 0 && viewport.height > 0 ? viewport : undefined,
    screenSize:
      screen && screen.width > 0 && screen.height > 0 ? screen : undefined,
    language: getLanguage() || undefined,
    hostname: getHostname(),
    timestamp: Date.now(),
  };
}

/**
 * Get full page URL
 */
export function getPageUrl(includeHash = false): string {
  if (!hasDOM()) return '/';
  
  const url = window.location.pathname + window.location.search + window.location.hash;
  return includeHash ? url : url.replace(/#.*$/, '');
}

/**
 * Parse URL to get clean pathname
 */
export function getPathname(url?: string): string {
  if (!url && hasDOM()) {
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
  if (!hasDOM()) return false;
  
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
  if (!hasDOM()) return false;
  
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
  if (!hasDOM()) return false;
  
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
  if (!hasDOM()) return false;
  return document.hidden || false;
}

/**
 * Format screen resolution string
 */
export function getScreenResolution(): string {
  if (!hasDOM()) return '';
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