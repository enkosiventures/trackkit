// Main facade
export {
  init,
  destroy,
  track,
  pageview,
  identify
} from './facade/singleton';

// Consent API
export { 
  getConsent, 
  grantConsent, 
  denyConsent, 
  resetConsent, 
  // onConsentChange,
} from './consent/exports';

// Utilities
export {
  waitForReady,
  getFacade,
  flushIfReady,
  hasQueuedEvents,
  getDiagnostics,
} from './facade/singleton';

// Types
export * from './types';