import { getFacade } from '../core/facade-singleton';

/**
 * Track a pageview event
 * @param url - Optional URL override (defaults to current page)
 */
export function pageview(url?: string): void {
  getFacade().pageview(url);
}

export default pageview;