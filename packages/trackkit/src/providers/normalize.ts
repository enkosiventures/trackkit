import { GA_HOST, PLAUSIBLE_HOST, UMAMI_HOST } from "../constants";
import type { ProviderOptions, ResolvedProviderOptions } from "../types";
import { GA4Options, ResolvedGA4Options } from "./ga4/types";
import { PlausibleOptions } from "./plausible";
import { ResolvedPlausibleOptions } from "./plausible/types";
import { UmamiOptions } from "./umami";
import { ResolvedUmamiOptions } from "./umami/types";


export function normalizeProviderOptions(options: ProviderOptions): ResolvedProviderOptions{
  switch (options.name) {
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

const normalizePlausible = (options: PlausibleOptions): ResolvedPlausibleOptions => ({
  name: 'plausible' as const,
  defaultProps: options.defaultProps,
  domain: options.domain,
  host: options.host ?? PLAUSIBLE_HOST,
  revenue: options.revenue,
} as const);

const normalizeUmami = (options: UmamiOptions): ResolvedUmamiOptions => ({
  name: 'umami' as const,
  host: options.host ?? UMAMI_HOST,
  website: options.website,
} as const);

const normalizeGA4 = (options: GA4Options): ResolvedGA4Options => ({
  name: 'ga4' as const,
  debugMode: options.debugMode ?? false,
  host: options.host ?? GA_HOST,
  measurementId: options.measurementId,
  apiSecret: options.apiSecret,
  customDimensions: options.customDimensions,
  customMetrics: options.customMetrics,
  debugEndpoint: options.debugEndpoint,
} as const);
