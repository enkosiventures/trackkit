import { ProviderType } from '../types';
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
  trackLocalhost?: boolean;
}

/**
 * Static metadata for providers
 * Available synchronously before provider loading
 */
export const providerMetadata: Record<ProviderType, ProviderMetadata> = {
  noop: {
    slug: 'noop',
    name: 'No Operation',
    version: '1.0.0',
    description: 'Development provider that logs events without sending',
    privacyFriendly: true,
    cookieless: true,
    openSource: true,
    trackLocalhost: true,
    consentDefaults: {
      requireExplicit: true,
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
    trackLocalhost: true,
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
    trackLocalhost: false,
    consentDefaults: {
      requireExplicit: true,
      supportsEssential: false,
      defaultMode: 'opt-in',
      categories: ['analytics'],
    },
  },
  
  ga4: {
    slug: 'ga4',
    name: 'Google Analytics 4',
    version: '1.0.0',
    description: 'Google\'s analytics platform with advanced features',
    privacyFriendly: false,
    cookieless: false,
    openSource: false,
    trackLocalhost: true,
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
export function getProviderMetadata(provider?: ProviderType): ProviderMetadata | undefined {
  return provider ? providerMetadata[provider] : undefined;
}