import type { ConsentStoredState } from './types';
import { logger } from '../util/logger';
import { getFacade } from '../facade/singleton';


export function getConsent(): ConsentStoredState | null {
  return getFacade()?.getSnapshot() || null;
}

export function grantConsent(): void {
  const facade = getFacade();
  if (!facade) {
    logger.warn('Analytics not initialized - cannot grant consent');
    return;
  }

  logger.debug('Granting analytics consent');
  facade.grantConsent();  

  logger.debug('Flushing queued events after consent granted');
  facade.flushIfReady();
}

export function denyConsent(): void {
  const facade = getFacade();
  if (!facade) {
    logger.warn('Analytics not initialized - cannot deny consent');
    return;
  }

  logger.debug('Denying analytics consent');
  facade.denyConsent();

  // Queue is cleared in facade callback, but may not be
  // triggered if consent denied before ready
  facade.flushIfReady();
}

export function resetConsent(): void {
  const facade = getFacade();
  if (!facade) {
    logger.warn('Analytics not initialized - cannot reset consent');
    return;
  }

  facade.resetConsent();
}

// export function onConsentChange(callback: (status: ConsentStatus, prev: ConsentStatus) => void): () => void {
//   const facade = getFacade();
//   const consent = facade.getConsentManager();
//   if (!consent) {
//     logger.warn('Analytics not initialized - cannot subscribe to consent changes');
//     return () => {};
//   }
//   return consent.onChange(callback);
// }
