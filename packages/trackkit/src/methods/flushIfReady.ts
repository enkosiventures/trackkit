import { flushIfReady as flush } from '../facade/singleton';

/**
 * Flush queued events if the facade is ready
 * @returns true if events were flushed, false otherwise
 */
export const flushIfReady = flush;
export default flushIfReady;