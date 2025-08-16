import { getFacade } from '../core/facade-singleton';
import { InitOptions } from '../types';

/**
 * Initialize the analytics system
 * This sets up the provider and prepares for tracking events.
 * @param options - Configuration options for analytics
 * @default {}
 * @example
 * init({ provider: 'umami', site: 'G-XXXXXXXXXX', debug: true });
 * @see {@link InitOptions} for available options
 */
export function init(options: InitOptions = {}): void {
  getFacade().init(options);
}
export default init;