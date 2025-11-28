/**
 * Cross-platform environment variable reader
 * Supports build-time (process.env) and runtime (window) access
 */

import { stripEmptyFields } from "../util";
import type { AnalyticsOptions } from "../types";

export interface EnvConfig {
  provider?: string;
  site?: string;
  host?: string;
  queueSize?: string;
  debug?: string;
}

const ENV_PREFIX = 'TRACKKIT_';
const VITE_PREFIX = 'VITE_';
const REACT_PREFIX = 'REACT_APP_';

/**
 * Global container for environment variables
 */
declare global {
  var __TRACKKIT_ENV__: any;
}

/**
 * Get environment variable with fallback chain:
 * 1. Direct env var (TRACKKIT_*)
 * 2. Vite env var (VITE_TRACKKIT_*)
 * 3. CRA env var (REACT_APP_TRACKKIT_*)
 * 4. Window.__TRACKKIT_ENV__ (for runtime config)
 */
function getEnvVar(key: string): string | undefined {
  const envKey = `${ENV_PREFIX}${key}`;
  
  // Runtime resolution
  if (typeof window !== 'undefined') {
    // Check for injected config object
    const runtimeConfig = globalThis.__TRACKKIT_ENV__;
    if (runtimeConfig && typeof runtimeConfig === 'object' && runtimeConfig[key]) {
      return runtimeConfig[key];
    }
    
    // Check meta tags (for static hosting)
    if (typeof document !== 'undefined') {
      const metaTag = document.querySelector(`meta[name="${envKey}"]`);
      const metaTagContent = metaTag?.getAttribute('content');
      if (metaTagContent) return metaTagContent;
    }
  }
  
  // Build-time resolution
  if (typeof process !== 'undefined' && process.env) {
    return process.env[envKey] ??
           process.env[`${VITE_PREFIX}${envKey}`] ??
           process.env[`${REACT_PREFIX}${envKey}`];
  }

  return undefined;
}

function maybeFormat(value: string | undefined, formatter?: (val: string) => any): any | undefined {
  if (value === undefined) return undefined;
  // Try to parse as JSON first
  try {
    return JSON.parse(value);
  } catch (_e) {
    // If that fails, use the provided formatter
    if (!formatter) return value;
    return formatter(value);
  }
}

export function readEnvConfig(): AnalyticsOptions {
  return stripEmptyFields<AnalyticsOptions>({
    // FACADE OPTIONS
    allowWhenHidden: parseEnvBoolean(getEnvVar('ALLOW_WHEN_HIDDEN')),
    autoTrack: parseEnvBoolean(getEnvVar('AUTO_TRACK')),
    bustCache: parseEnvBoolean(getEnvVar('BUST_CACHE')),
    consent: maybeFormat(getEnvVar('CONSENT')),
    debug: parseEnvBoolean(getEnvVar('DEBUG')),
    domains: maybeFormat(getEnvVar('DOMAINS'), s => s.split(',').map(x => x.trim())),
    doNotTrack: parseEnvBoolean(getEnvVar('DO_NOT_TRACK')),
    exclude: maybeFormat(getEnvVar('EXCLUDE'), s => s.split(',').map(x => x.trim())),
    includeHash: parseEnvBoolean(getEnvVar('INCLUDE_HASH')),
    navigationSource: maybeFormat(getEnvVar('NAVIGATION_SOURCE')),
    queueSize: maybeFormat(getEnvVar('QUEUE_SIZE'), parseInt),
    trackLocalhost: parseEnvBoolean(getEnvVar('TRACK_LOCALHOST')),

    // PROVIDER OPTIONS
    provider: maybeFormat(getEnvVar('PROVIDER')),

    // DISPATCHER OPTIONS
    dispatcher: maybeFormat(getEnvVar('DISPATCHER')),
  });
}

/**
 * Parse boolean environment variable
 */
export function parseEnvBoolean(value: string | undefined, defaultValue = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true' || value === '1';
}

/**
 * Parse numeric environment variable
 */
export function parseEnvNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Environment detection helpers
 * --------------------------------
 * Keep these as the only primitives used across the codebase.
 */

/** True if a `window` global exists. Client runtime (main thread or JSDOM), not SSR/Node/workers. */
export function isClient(): boolean {
  return typeof window !== 'undefined';
}

/** True if DOM APIs are available (safe to touch `document`, `history`, add event listeners). */
export function hasDOM(): boolean {
  return isClient() && typeof document !== 'undefined';
}

/** True if running on the browser main thread (DOM + `navigator` present). */
export function isBrowserMainThread(): boolean {
  return hasDOM() && typeof navigator !== 'undefined';
}

/** True if SSR/Node/Workers (no `window`). */
export function isServer(): boolean {
  return !isClient();
}

export function hasWebStorage(): boolean {
  return isClient() && typeof window.localStorage !== 'undefined';
}

/** True if inside a Worker-like global (no `window`, but `self` + `importScripts`). */
export function isWorker(): boolean {
  return typeof self !== 'undefined' &&
         typeof window === 'undefined' &&
         typeof (self as any).importScripts === 'function';
}
