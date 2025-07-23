import { waitForReady as wait } from '../core/facade-singleton';

/**
 * Wait for analytics provider to be ready
 * @returns Promise that resolves with provider instance
 */
export const waitForReady = wait;
export default waitForReady;