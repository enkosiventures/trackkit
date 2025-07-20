export * from './types';
export { ConsentManager } from './manager';

import { ConsentManager } from './manager';
import type { ConsentOptions, ConsentState } from './types';

// Global consent manager instance
let globalConsent: ConsentManager | null = null;

/**
 * Get or create the global consent manager
 * @internal
 */
export function getConsentManager(options?: ConsentOptions): ConsentManager {
  if (!globalConsent) {
    globalConsent = new ConsentManager(options);
  }
  return globalConsent;
}

/**
 * Reset global consent manager (mainly for testing)
 * @internal
 */
export function resetConsentManager(): void {
  globalConsent = null;
}