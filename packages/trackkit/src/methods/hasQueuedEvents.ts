import { hasQueuedEvents as hasEvents } from '../facade/singleton';

/**
 * Check if there are any queued events ready to be sent
 * @returns true if there are queued events, false otherwise
 */
export const hasQueuedEvents = hasEvents;
export default hasQueuedEvents;