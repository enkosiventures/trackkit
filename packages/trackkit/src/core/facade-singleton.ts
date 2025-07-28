import { AnalyticsFacade } from './facade';
import type { AnalyticsOptions, Props } from '../types';

// Singleton instance
let facadeInstance: AnalyticsFacade | null = null;

/**
 * Get or create the facade instance
 */
export function getFacade(): AnalyticsFacade {
  if (!facadeInstance) {
    facadeInstance = new AnalyticsFacade();
  }
  return facadeInstance;
}

// Convenience exports that delegate to singleton
export const init = (options: AnalyticsOptions = {}) => getFacade().init(options);
export const destroy = () => {
  getFacade().destroy();
  facadeInstance = null; // Allow re-initialization after destroy
};
export const track = (name: string, props?: Props, url?: string) => getFacade().track(name, props, url);
export const pageview = (url?: string) => getFacade().pageview(url);
export const identify = (userId: string | null) => getFacade().identify(userId);

// Utility exports
export const waitForReady = () => getFacade().waitForReady();
export const getInstance = () => getFacade().getProvider();
export const getDiagnostics = () => getFacade().getDiagnostics();

// Testing helpers
export const hasQueuedEvents = () => getFacade().hasQueuedEvents();
export const flushIfReady = () => getFacade().flushIfReady();