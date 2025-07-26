/**
 * Shared utilities for analytics providers
 * These are internal APIs not exposed to end users
 */

// Types
export * from './types';

// Browser utilities
export {
  isBrowser,
  getBrowserData,
  getPageUrl,
  getPathname,
  isDoNotTrackEnabled,
  isDomainAllowed,
  isUrlExcluded,
  isLocalhost,
  isPageHidden,
  getScreenResolution,
  safeStringify,
} from './browser';

// Navigation tracking
export {
  NavigationTracker,
  createNavigationTracker,
} from './navigation';

// Transport layer
export {
  Transport,
  createTransport,
  type TransportMethod,
} from './transport';

// Base client
export { BaseClient } from './base-client';

// Validation utilities
export {
  validateUUID,
  validateGA4MeasurementId,
  validateDomain,
  validateUrl,
  validateApiKey,
  validateNumber,
  createValidationError,
} from './validation';