/**
 * Cross-platform environment variable reader
 * Supports build-time (process.env) and runtime (window) access
 */

import { isPlainObject, stripEmptyFields } from "../util";
import type { AnalyticsOptions, FacadeOptions, ProviderOptions } from "../types";
import type { NoopOptions } from "../providers/noop/types";
import type { BatchingOptions, DispatcherOptions, ConnectionOptions, PerformanceOptions, ProxyTransportOptions, ResilienceOptions, RetryOptions, TransportMode } from "../dispatcher/types";
import type { PlausibleOptions } from "../providers/plausible";
import { AnalyticsError, dispatchError } from "../errors";
import type { ConsentOptions } from "../consent/types";

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

function tryParseEnvVar(key: string): any | undefined {
  const value = getEnvVar(key);
  if (!value) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}


// Type conversion helpers for env var parsing

const toString = (value: any): string | undefined => typeof value === 'string' ? value : undefined;

const toNumber = (value: any): number | undefined => typeof value === 'number' ? value : undefined;

const toBoolean = (value: any): boolean | undefined => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value > 0;
  return undefined;
}

function toArray<T>(value: any, type: string): T[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: T[] = [];
  for (const item of value) {
    if (typeof item === type) {
      result.push(item);
    }
  }
  return result;
}

const toStringArray = (value: any): string[] | undefined => toArray<string>(value, 'string');

const toNumberArray = (value: any): number[] | undefined => toArray<number>(value, 'number');

function toStringRecord(value: any): Record<string, string | undefined> | undefined {
  if (!isPlainObject(value)) return undefined;
  const record: Record<string, string | undefined> = {};
  for (const key in value) {
    if (typeof value[key] === 'string') {
      record[key] = value[key];
    }
  }
  return record;
}

function formatFacadeConfig(): FacadeOptions | undefined {
  try {
    const parsedConsent = tryParseEnvVar('CONSENT');

    return stripEmptyFields<FacadeOptions>({
      allowWhenHidden: toBoolean(tryParseEnvVar('ALLOW_WHEN_HIDDEN')),
      autoTrack: toBoolean(tryParseEnvVar('AUTO_TRACK')),
      bustCache: toBoolean(tryParseEnvVar('BUST_CACHE')),
      consent: parsedConsent ? stripEmptyFields<ConsentOptions>({
        initialStatus: toString(parsedConsent.initialStatus) as any,
        storageKey: toString(parsedConsent.storageKey),
        disablePersistence: toBoolean(parsedConsent.disablePersistence),
        policyVersion: toString(parsedConsent.policyVersion),
        requireExplicit: toBoolean(parsedConsent.requireExplicit),
        allowEssentialOnDenied: toBoolean(parsedConsent.allowEssentialOnDenied),
      }) : undefined,
      debug: toBoolean(tryParseEnvVar('DEBUG')),
      domains: toStringArray(tryParseEnvVar('DOMAINS')),
      doNotTrack: toBoolean(tryParseEnvVar('DO_NOT_TRACK')),
      exclude: toStringArray(tryParseEnvVar('EXCLUDE')),
      includeHash: toBoolean(tryParseEnvVar('INCLUDE_HASH')),
      queueSize: toNumber(tryParseEnvVar('QUEUE_SIZE')),
      trackLocalhost: toBoolean(tryParseEnvVar('TRACK_LOCALHOST')),
    });
  } catch (e) {
    console.warn('Failed to parse facade config from environment variable', e);
    dispatchError(
      new AnalyticsError(
        'Failed to parse facade config from environment variable',
        'INVALID_CONFIG',
        undefined,
        e as Error,
      )
    );
  }
}


// Main exported function to read env config

/**
 * Reads analytics configuration from environment variables.
 * @returns AnalyticsOptions object populated from env vars.
 */
export function readEnvConfig(): AnalyticsOptions {
  return stripEmptyFields<AnalyticsOptions>({
    // FACADE OPTIONS
    ...formatFacadeConfig(),

    // PROVIDER OPTIONS
    provider: formatProviderConfig(getEnvVar('PROVIDER')),

    // DISPATCHER OPTIONS
    dispatcher: formatDispatcherConfig(getEnvVar('DISPATCHER')),
  });
}

function formatDispatcherConfig(value: string | undefined): DispatcherOptions | undefined {
  if (!value) return undefined;

  try {
    const parsed = JSON.parse(value);
    if (!parsed) {
      return undefined;
    }

    const transportMode = ['smart', 'fetch', 'beacon', 'proxy', 'noop'].includes(parsed.transportMode as string)
      ? (parsed.transportMode as TransportMode)
      : undefined;

    const fallbackStrategy = ['none', 'memory', 'localStorage'].includes(parsed.resilience?.fallbackStrategy as string)
      ? (parsed.resilience!.fallbackStrategy as ResilienceOptions['fallbackStrategy'])
      : undefined;

    return stripEmptyFields<DispatcherOptions>({
      transportMode,
      defaultHeaders: toStringRecord(parsed.defaultHeaders),
      batching: stripEmptyFields<BatchingOptions>({
        enabled: toBoolean(parsed.batching?.enabled),
        maxSize: toNumber(parsed.batching?.maxSize),
        maxWait: toNumber(parsed.batching?.maxWait),
        maxBytes: toNumber(parsed.batching?.maxBytes),
        concurrency: toNumber(parsed.batching?.concurrency),
        deduplication: toBoolean(parsed.batching?.deduplication),
      }),
      performance: stripEmptyFields<Partial<PerformanceOptions>>({
        enabled: toBoolean(parsed.performance?.enabled),
        sampleRate: toNumber(parsed.performance?.sampleRate),
        windowSize: toNumber(parsed.performance?.windowSize),
      }),
      connection: stripEmptyFields<Partial<ConnectionOptions>>({
        monitor: toBoolean(parsed.connection?.monitor),
        offlineStorage: toBoolean(parsed.connection?.offlineStorage),
        syncInterval: toNumber(parsed.connection?.syncInterval),
        slowThreshold: toNumber(parsed.connection?.slowThreshold),
        checkInterval: toNumber(parsed.connection?.checkInterval),
      }),
      resilience: stripEmptyFields<Partial<ResilienceOptions>>({
        detectBlockers: toBoolean(parsed.resilience?.detectBlockers),
        fallbackStrategy,
        proxy: parsed.resilience.proxy?.proxyUrl ? stripEmptyFields<ProxyTransportOptions>({
          proxyUrl: toString(parsed.resilience.proxy?.proxyUrl) as string,
          token: toString(parsed.resilience.proxy?.token),
          headers: toStringRecord(parsed.resilience.proxy?.headers),
          keepalive: toBoolean(parsed.resilience.proxy?.keepalive),
          allowlist: toStringArray(parsed.resilience.proxy?.allowlist),
        }) : undefined,
        retry: parsed.resilience.retry ?stripEmptyFields<Partial<RetryOptions>>({
          maxAttempts: toNumber(parsed.resilience.retry.maxAttempts),
          initialDelay: toNumber(parsed.resilience.retry.initialDelay),
          maxDelay: toNumber(parsed.resilience.retry.maxDelay),
          multiplier: toNumber(parsed.resilience.retry.multiplier),
          jitter: toBoolean(parsed.resilience.retry.jitter),
          retryableStatuses: toNumberArray(parsed.resilience.retry.retryableStatuses),
        }) : undefined,
      }),
    });
  } catch (e) {
    console.warn('Failed to parse dispatcher config from environment variable', e);
    dispatchError(
      new AnalyticsError(
        'Failed to parse dispatcher config from environment variable',
        'INVALID_CONFIG',
        undefined,
        e as Error,
      )
    );
    return undefined;
  }
}


function formatProviderConfig(value: string | undefined): ProviderOptions | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value);
    if (!parsed || !parsed.name) {
      return undefined;
    }

    switch (parsed.name) {
      case 'umami':
        return stripEmptyFields<ProviderOptions>({
          name: 'umami',
          host: toString(parsed.host),
          website: toString(parsed.website),
        });
      case 'plausible':
        return stripEmptyFields<ProviderOptions>({
          name: 'plausible',
          host: toString(parsed.host),
          domain: toString(parsed.domain),
          revenue: parsed.revenue ? stripEmptyFields<PlausibleOptions['revenue']>({
            currency: toString(parsed.revenue.currency) ?? '$',
            trackingEnabled: toBoolean(parsed.revenue.trackingEnabled) ?? false,
          }) : undefined,
          defaultProps: toStringRecord(parsed.defaultProps),
        });
      case 'ga4':
        return stripEmptyFields<ProviderOptions>({
          name: 'ga4',
          host: toString(parsed.host),
          measurementId: toString(parsed.measurementId),
          apiSecret: toString(parsed.apiSecret),
          customDimensions: toStringRecord(parsed.customDimensions),
          customMetrics: toStringRecord(parsed.customMetrics),
          debugEndpoint: toBoolean(parsed.debugEndpoint),
          debugMode: toBoolean(parsed.debugMode),

        });
      case 'noop':
        return parsed as NoopOptions;

      default:
        return undefined;
    }
  } catch (e) {
    console.warn('Failed to parse provider config from environment variable', e);
    dispatchError(
      new AnalyticsError(
        'Failed to parse provider config from environment variable',
        'INVALID_CONFIG',
        undefined,
        e as Error,
      )
    );
    return undefined;
  }
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
