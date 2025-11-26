import type { EventType, ProviderType } from '../types';
import { isBrowserMainThread } from '../util/env';
import { getProviderMetadata } from '../providers/metadata';
import { isDoNotTrackEnabled, isLocalhost, isDomainAllowed, isUrlExcluded } from '../providers/browser';
import { DEFAULT_CATEGORY } from '../constants';
import type { ConsentManager } from '../consent/ConsentManager';
import type { FacadeOptions } from '../types';

export type SendDecision = { ok: boolean; reason:
  'ok'|'not-browser'|'consent-pending'|'consent-denied'|'dnt'|'localhost'|'domain-excluded'
};

export class PolicyGate {
  constructor(private cfg: FacadeOptions, private consent: ConsentManager | null, private providerKey: ProviderType) {}
  shouldSend(type: EventType, category = DEFAULT_CATEGORY, url?: string): SendDecision {
    let consentStatus;
    if (!this.consent?.isAllowed(category)) consentStatus = this.consent?.getStatus();

    // Consent denial is an absolute stop: if a category is not allowed, we never
    // send or even queue the event, regardless of browser state. This ensures
    // that changing consent to "denied" has an immediate effect and cannot be
    // bypassed by local storage / SSR / retry logic.
    if (consentStatus === 'denied') return { ok: false, reason: 'consent-denied' };

    if (!isBrowserMainThread()) return { ok: false, reason: 'not-browser' };
    if (consentStatus) return { ok: false, reason: 'consent-pending' };
    if (this.cfg?.doNotTrack !== false && isDoNotTrackEnabled()) return { ok: false, reason: 'dnt' };
    const allowLocalhost = this.cfg?.trackLocalhost ?? (getProviderMetadata(this.providerKey)?.trackLocalhost ?? true);
    if (!allowLocalhost && isLocalhost()) return { ok: false, reason: 'localhost' };
    if (type === 'pageview') {
      if (!isDomainAllowed(this.cfg?.domains)) return { ok: false, reason: 'domain-excluded' };
      if (url && isUrlExcluded(url, this.cfg?.exclude)) return { ok: false, reason: 'domain-excluded' };
    }
    return { ok: true, reason: 'ok' };
  }
}