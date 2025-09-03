import type { EventType, ProviderType } from '../types';
import { isBrowser } from '../util/env';
import { getProviderMetadata } from '../providers/metadata';
import { isDoNotTrackEnabled, isLocalhost, isDomainAllowed, isUrlExcluded } from '../providers/shared/browser';
import { DEFAULT_CATEGORY } from '../constants';
import type { ConsentManager } from '../consent/ConsentManager';
import type { FacadeOptions } from '../types';

export type SendDecision = { ok: boolean; reason:
  'ok'|'not-browser'|'consent-pending'|'consent-denied'|'dnt'|'localhost'|'domain-excluded'
};

export class PolicyGate {
  constructor(private cfg: FacadeOptions, private consent: ConsentManager | null, private providerKey: ProviderType) {}
  shouldSend(type: EventType, category = DEFAULT_CATEGORY, url?: string): SendDecision {
    if (!isBrowser()) return { ok: false, reason: 'not-browser' };
    if (!this.consent?.isAllowed(category)) {
      const s = this.consent?.getStatus();
      return { ok: false, reason: s === 'denied' ? 'consent-denied' : 'consent-pending' };
    }
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