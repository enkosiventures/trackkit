import type { ConsentCategory } from '../consent/types';
import { track as facadeTrack } from '../facade/singleton';
import type { Props } from '../types';

 /**
  * Track a custom event
  * @param name - Event name (e.g., 'button_click')
  * @param props - Optional event properties
  * @param category - Optional event category for grouping (defaults to 'analytics')
  */
export function track(name: string, props?: Props, category?: ConsentCategory): void {
//   getFacade().track(name, props, category);
    facadeTrack(name, props, category);
}

// Default export for single-method imports
export default track;