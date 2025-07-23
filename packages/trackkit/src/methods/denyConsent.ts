import { denyConsent as deny } from '../consent/exports';

/**
 * Deny analytics consent
 * Clears queued events and disables tracking
 */
export const denyConsent = deny;
export default denyConsent;