import { GA_HOST, PLAUSIBLE_HOST, UMAMI_HOST } from "../constants";
import type { ProviderOptions, ResolvedProviderOptions } from "../types";


export function normalizeProviderOptions(options: ProviderOptions): ResolvedProviderOptions{
  switch (options.provider) {
    case 'plausible':
      return normalizePlausible(options);
    case 'umami':
      return normalizeUmami(options);
    case 'ga4':
      return normalizeGA4(options);
    case 'noop':
      return options;
  }
}

function normalizePlausible(options: Extract<ProviderOptions, { provider: 'plausible' }>) {
  return {
    provider: 'plausible' as const,
    domain: options.domain,
    host: options.host ?? PLAUSIBLE_HOST,
    revenue: options.revenue,
  };
}

function normalizeUmami(options: Extract<ProviderOptions, { provider: 'umami' }>) {
  return {
    provider: 'umami' as const,
    website: options.website,
    host: options.host ?? UMAMI_HOST,
  };
}

function normalizeGA4(options: Extract<ProviderOptions, { provider: 'ga4' }>) {
  return {
    provider: 'ga4' as const,
    measurementId: options.measurementId,
    host: options.host ?? GA_HOST,
    apiSecret: options.apiSecret,
    customDimensions: options.customDimensions ?? {},
    customMetrics: options.customMetrics ?? {},
    debugEndpoint: options.debugEndpoint,
    debugMode: options.debugMode ?? false,
  };
}
