import { getFacade } from '../core/facade-singleton';

/**
 * Track a pageview event
 */
export function pageview(): void {
  getFacade().pageview();
}

export default pageview;