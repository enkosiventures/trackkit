import { getFacade } from '../core/facade-singleton';
import type { Props } from '../types';

/**
 * Track a custom analytics event
 * @param name - Event name
 * @param props - Event properties
 * @param url - Optional URL override
 */
export function track(name: string, props?: Props, url?: string): void {
  getFacade().track(name, props, url);
}

// Default export for single-method imports
export default track;