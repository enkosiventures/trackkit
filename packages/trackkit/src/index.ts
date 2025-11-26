// Factory API
export { createAnalytics } from './factory';

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
  onConsentChange,
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

// // Provider options (so ProviderOptions' unions resolve to documented symbols)
// export type { UmamiOptions } from './providers/umami/types';
// export type { PlausibleOptions } from './providers/plausible/types';
// export type { GA4Options } from './providers/ga4/types';

// // Dispatcher / resilience / performance option types
// export type * from './dispatcher/types';

// // Consent & errors
// export type {
//   ConsentOptions,
//   ConsentCategory,
//   ConsentStatus,
//   ConsentStoredState,
// } from './consent/types';
// export type { AnalyticsError } from './errors';

// // Diagnostics
// export type { DiagnosticsSnapshot } from './facade/diagnostics';

// // SSR queue type if it's part of the public API
// export type { QueuedEventUnion } from './queues/types';

// // // If your public functions mention AnalyticsFacade in their signatures,
// // // either export the class/type or return a public interface instead (see B).
// export { AnalyticsFacade } from './facade';         // concrete class
// // // or: export type { AnalyticsFacade } from './facade';