import type { ConsentSnapshot, ConsentStatus } from './types';
import { logger } from '../util/logger';
import { getFacade } from '../core/facade-singleton';


export function getConsent(): ConsentSnapshot | null {
  const consent = getFacade().getConsentManager();
  return consent?.snapshot() || null;
}

export function grantConsent(): void {
  const facade = getFacade();
  const consent = facade.getConsentManager();
  
  if (!consent) {
    logger.warn('Analytics not initialized - cannot grant consent');
    return;
  }
  
  logger.debug('Granting analytics consent');
  consent.grant();
  logger.debug('Flushing queued events after consent granted');
  facade.flushIfReady();
}

export function denyConsent(): void {
  const facade = getFacade();
  const consent = facade.getConsentManager();

  if (!consent) {
    logger.warn('Analytics not initialized - cannot deny consent');
    return;
  }

  consent.deny();
  
  // Queue is cleared in facade callback, but may not be 
  // triggered if consent denied before ready
  facade.getQueue().clear();
}

export function resetConsent(): void {
  const facade = getFacade();
  const consent = facade.getConsentManager();

  if (!consent) {
    logger.warn('Analytics not initialized - cannot reset consent');
    return;
  }
  consent.reset();
}

export function onConsentChange(callback: (status: ConsentStatus, prev: ConsentStatus) => void): () => void {
  const facade = getFacade();
  const consent = facade.getConsentManager();
  if (!consent) {
    logger.warn('Analytics not initialized - cannot subscribe to consent changes');
    return () => {};
  }
  return consent.onChange(callback);
}
