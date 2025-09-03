import { getFacade } from '../facade/singleton';

/**
 * Track a pageview event
 */
export function pageview(): void {
  getFacade()?.pageview();
}

export default pageview;