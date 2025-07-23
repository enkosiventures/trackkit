import type { ProviderConsentConfig } from './types';

export interface ProviderMetadata {
  name: string;
  version: string;
  consentDefaults?: ProviderConsentConfig;
  description?: string;
}

/**
 * Static metadata for providers
 * Available synchronously before provider loading
 */
export const providerMetadata: Record<string, ProviderMetadata> = {
  noop: {
    name: 'noop',
    version: '1.0.0',
    description: 'No-operation provider for testing',
    consentDefaults: {
      requireExplicit: false,
      supportsEssential: true,
      defaultMode: 'essential-only',
      categories: ['essential'],
    },
  },
  
  umami: {
    name: 'umami-browser',
    version: '1.0.0',
    description: 'Privacy-focused analytics',
    consentDefaults: {
      requireExplicit: true,  // GDPR compliance by default
      supportsEssential: false,
      defaultMode: 'opt-in',
      categories: ['analytics'],
    },
  },
  
  // Future providers
  // plausible: {
  //   name: 'plausible',
  //   version: '1.0.0',
  //   description: 'Privacy-friendly analytics',
  //   consentDefaults: {
  //     requireExplicit: true,
  //     supportsEssential: false,
  //     defaultMode: 'opt-in',
  //     categories: ['analytics'],
  //   },
  // },
  
  // ga: {
  //   name: 'ga4',
  //   version: '1.0.0',
  //   description: 'Google Analytics 4',
  //   consentDefaults: {
  //     requireExplicit: true,
  //     supportsEssential: false,
  //     defaultMode: 'opt-in',
  //     categories: ['analytics', 'marketing'],
  //   },
  // },
};

/**
 * Get provider metadata synchronously
 */
export function getProviderMetadata(provider: string): ProviderMetadata | undefined {
  return providerMetadata[provider];
}