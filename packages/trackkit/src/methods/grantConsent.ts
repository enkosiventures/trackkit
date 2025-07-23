import { grantConsent as grant } from '../consent/exports';

/**
 * Grant analytics consent
 * Flushes any queued events and enables tracking
 */
export const grantConsent = grant;
export default grantConsent;