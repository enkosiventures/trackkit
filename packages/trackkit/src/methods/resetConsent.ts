import { resetConsent as reset } from '../consent/exports';

/**
 * Reset consent to pending state
 * Clears stored consent and requires new decision
 */
export const resetConsent = reset;
export default resetConsent;