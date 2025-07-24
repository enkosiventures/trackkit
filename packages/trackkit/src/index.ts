// Main facade
export {
  init,
  destroy,
  track,
  pageview,
  identify
} from './core/facade-singleton';

// Consent API
export { 
  getConsent, 
  grantConsent, 
  denyConsent, 
  resetConsent, 
  onConsentChange 
} from './consent/exports';

// Utilities
export {
  waitForReady,
  getInstance,
  flushIfReady,
  hasQueuedEvents,
  getDiagnostics,
} from './core/facade-singleton';

// Types
export * from './types';