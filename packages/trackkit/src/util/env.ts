/**
 * Cross-platform environment variable reader
 * Supports build-time (process.env) and runtime (window) access
 */

export interface EnvConfig {
  provider?: string;
  siteId?: string;
  host?: string;
  queueSize?: string;
  debug?: string;
}

const ENV_PREFIX = 'TRACKKIT_';
const VITE_PREFIX = 'VITE_';
const REACT_PREFIX = 'REACT_APP_';

/**
 * Get environment variable with fallback chain:
 * 1. Direct env var (TRACKKIT_*)
 * 2. Vite env var (VITE_TRACKKIT_*)
 * 3. CRA env var (REACT_APP_TRACKKIT_*)
 * 4. Window.__TRACKKIT_ENV__ (for runtime config)
 */
function getEnvVar(key: string): string | undefined {
  const envKey = `${ENV_PREFIX}${key}`;
  
  // Build-time resolution
  if (typeof process !== 'undefined' && process.env) {
    return process.env[envKey] ||
           process.env[`${VITE_PREFIX}${envKey}`] ||
           process.env[`${REACT_PREFIX}${envKey}`];
  }
  
  // Runtime resolution
  if (typeof window !== 'undefined') {
    // Check for injected config object
    const runtimeConfig = (window as any).__TRACKKIT_ENV__;
    if (runtimeConfig && typeof runtimeConfig === 'object') {
      return runtimeConfig[key];
    }
    
    // Check meta tags (for static hosting)
    if (typeof document !== 'undefined') {
      const metaTag = document.querySelector(`meta[name="${envKey}"]`);
      if (metaTag) return metaTag.getAttribute('content') || undefined;
    }
  }
  
  return undefined;
}

export function readEnvConfig(): EnvConfig {
  return {
    provider: getEnvVar('PROVIDER'),
    siteId: getEnvVar('SITE_ID'),
    host: getEnvVar('HOST'),
    queueSize: getEnvVar('QUEUE_SIZE'),
    debug: getEnvVar('DEBUG'),
  };
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