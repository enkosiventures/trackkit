import type { EventType, ProviderType, ResolvedFacadeOptions } from '../types';
import { isBrowserMainThread } from '../util/env';
import { isDoNotTrackEnabled, isLocalhost, isDomainAllowed, isUrlExcluded } from '../providers/browser';
import { DEFAULT_CATEGORY } from '../constants';
import type { ConsentManager } from '../consent/ConsentManager';

export type SendDecision = { ok: boolean; reason:
  'ok'|'not-browser'|'consent-pending'|'consent-denied'|'dnt'|'localhost'|'domain-excluded'
};

export class PolicyGate {
  constructor(private facade: ResolvedFacadeOptions, private consent: ConsentManager | null) {}
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
    if (this.facade.doNotTrack !== false && isDoNotTrackEnabled()) return { ok: false, reason: 'dnt' };
    if (!this.facade.trackLocalhost && isLocalhost()) return { ok: false, reason: 'localhost' };
    if (type === 'pageview') {
      if (!isDomainAllowed(this.facade.domains)) return { ok: false, reason: 'domain-excluded' };
      if (url && isUrlExcluded(url, this.facade.exclude)) return { ok: false, reason: 'domain-excluded' };
    }
    return { ok: true, reason: 'ok' };
  }
}