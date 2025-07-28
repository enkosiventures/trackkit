/**
 * Shared utilities for analytics providers
 * These are internal APIs not exposed to end users
 */

// Types
export * from './types';

// Browser utilities
export {
  isBrowser,
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

// Storage utilities  
export {
  Storage,
  createStorage,
  tempStorage,
  persistentStorage,
  type StorageOptions,
} from './storage';

// Batching utilities
export {
  EventBatcher,
  RateLimiter,
  debounce,
  throttle,
  type BatchEvent,
  type BatchConfig,
} from './batching';