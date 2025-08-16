/**
 * Cross-platform environment variable reader
 * Supports build-time (process.env) and runtime (window) access
 */

import { stripEmptyFields } from "../providers/shared/utils";
import type { InitOptions } from "../types";

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
  } catch (e) {
    // If that fails, use the provided formatter
    if (!formatter) return value;
    return formatter(value);
  }
}

export function readEnvConfig(): InitOptions {
  return stripEmptyFields({
    provider: maybeFormat(getEnvVar('PROVIDER')),
    site: maybeFormat(getEnvVar('SITE')),
    host: maybeFormat(getEnvVar('HOST')),
    queueSize: maybeFormat(getEnvVar('QUEUE_SIZE'), parseInt),
    debug: parseEnvBoolean(getEnvVar('DEBUG')),
    batchSize: maybeFormat(getEnvVar('BATCH_SIZE'), parseInt),
    batchTimeout: maybeFormat(getEnvVar('BATCH_TIMEOUT'), parseInt),
    autoTrack: parseEnvBoolean(getEnvVar('AUTO_TRACK')),
    doNotTrack: parseEnvBoolean(getEnvVar('DO_NOT_TRACK')),
    domains: maybeFormat(getEnvVar('DOMAINS'), s => s.split(',').map(x => x.trim())),
    cache: parseEnvBoolean(getEnvVar('CACHE')),
    allowWhenHidden: parseEnvBoolean(getEnvVar('ALLOW_WHEN_HIDDEN')),
    apiSecret: maybeFormat(getEnvVar('API_SECRET')),
    customDimensions: maybeFormat(getEnvVar('CUSTOM_DIMENSIONS')),
    customMetrics: maybeFormat(getEnvVar('CUSTOM_METRICS')),
    transport: maybeFormat(getEnvVar('TRANSPORT')) as any,
    includeHash: parseEnvBoolean(getEnvVar('INCLUDE_HASH')),
    measurementId: maybeFormat(getEnvVar('MEASUREMENT_ID')),
    trackLocalhost: parseEnvBoolean(getEnvVar('TRACK_LOCALHOST')),
    exclude: maybeFormat(getEnvVar('EXCLUDE'), s => s.split(',').map(x => x.trim())),
    defaultProps: maybeFormat(getEnvVar('DEFAULT_PROPS')),
    revenue: maybeFormat(getEnvVar('REVENUE')),
    consent: maybeFormat(getEnvVar('CONSENT')),
    domain: maybeFormat(getEnvVar('DOMAIN')),
    website: maybeFormat(getEnvVar('WEBSITE')),
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
 * Check if we're in a browser environment
 */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && 
         typeof window.document !== 'undefined';
}
