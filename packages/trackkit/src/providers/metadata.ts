import type { ProviderConsentConfig } from './types';

export interface ProviderMetadata {
  slug: string;
  name: string;
  version: string;
  consentDefaults?: ProviderConsentConfig;
  description?: string;
  privacyFriendly?: boolean;
  cookieless?: boolean;
  openSource?: boolean;
}

/**
 * Static metadata for providers
 * Available synchronously before provider loading
 */
export const providerMetadata: Record<string, ProviderMetadata> = {
  noop: {
    slug: 'noop',
    name: 'No Operation',
    version: '1.0.0',
    description: 'Development provider that logs events without sending',
    privacyFriendly: true,
    cookieless: true,
    openSource: true,
    consentDefaults: {
      requireExplicit: false,
      supportsEssential: true,
      defaultMode: 'essential-only',
      categories: ['essential'],
    },
  },
  
  umami: {
    slug: 'umami-browser',
    name: 'Umami Browser',
    version: '1.0.0',
    description: 'Privacy-focused, open-source analytics',
    privacyFriendly: true,
    cookieless: true,
    openSource: true,
    consentDefaults: {
      requireExplicit: true,  // GDPR compliance by default
      supportsEssential: false,
      defaultMode: 'opt-in',
      categories: ['analytics'],
    },
  },

  plausible: {
    slug: 'plausible',
    name: 'Plausible',
    version: '1.0.0',
    description: 'Lightweight, privacy-friendly analytics',
    privacyFriendly: true,
    cookieless: true,
    openSource: true,
    consentDefaults: {
      requireExplicit: true,
      supportsEssential: false,
      defaultMode: 'opt-in',
      categories: ['analytics'],
    },
  },
  
  ga: {
    slug: 'ga4',
    name: 'Google Analytics 4',
    version: '1.0.0',
    description: 'Google\'s analytics platform with advanced features',
    privacyFriendly: false,
    cookieless: false,
    openSource: false,
    consentDefaults: {
      requireExplicit: true,
      supportsEssential: false,
      defaultMode: 'opt-in',
      categories: ['analytics', 'marketing'],
    },
  },
};

/**
 * Get provider metadata synchronously
 */
export function getProviderMetadata(provider: string): ProviderMetadata | undefined {
  return providerMetadata[provider];
}