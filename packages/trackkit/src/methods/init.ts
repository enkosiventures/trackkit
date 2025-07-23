import { getFacade } from '../core/facade-singleton';
import { AnalyticsOptions } from '../types';

/**
 * Initialize the analytics system
 * This sets up the provider and prepares for tracking events.
 * @param options - Configuration options for analytics
 * @default {}
 * @example
 * init({ provider: 'umami', siteId: 'G-XXXXXXXXXX', debug: true });
 * @see {@link AnalyticsOptions} for available options
 */
export function init(options: AnalyticsOptions = {}): void {
  getFacade().init(options);
}
export default init;