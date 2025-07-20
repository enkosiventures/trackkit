import { getConsent as get } from '../consent/exports';

/**
 * Get current consent status and statistics
 * @returns Consent snapshot or null if not initialized
 */
export const getConsent = get;
export default getConsent;