import type { NavigationHandler } from './types';
import { isBrowser } from './browser';
import { logger } from '../../util/logger';

/**
 * Navigation tracker for Single Page Applications
 * Detects navigation changes and calls the provided handler
 */
export class NavigationTracker {
  private handler: NavigationHandler;
  private previousPath: string;
  private originalPushState?: typeof history.pushState;
  private originalReplaceState?: typeof history.replaceState;
  private popstateListener?: (event: PopStateEvent) => void;
  private isDestroyed = false;
  
  constructor(handler: NavigationHandler) {
    this.handler = handler;
    this.previousPath = this.getCurrentPath();
  }
  
  /**
   * Start tracking navigation changes
   */
  start(): void {
    if (!isBrowser() || this.isDestroyed) return;
    
    logger.debug('Starting navigation tracking');
    
    // Track popstate events (back/forward button)
    this.popstateListener = () => this.checkForNavigation();
    window.addEventListener('popstate', this.popstateListener);
    
    // Override pushState and replaceState
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;
    
    const tracker = this;
    
    history.pushState = function(...args: Parameters<typeof history.pushState>) {
      tracker.originalPushState!.apply(history, args);
      // Use setTimeout to ensure URL has changed
      setTimeout(() => tracker.checkForNavigation(), 0);
    };
    
    history.replaceState = function(...args: Parameters<typeof history.replaceState>) {
      tracker.originalReplaceState!.apply(history, args);
      setTimeout(() => tracker.checkForNavigation(), 0);
    };
  }
  
  /**
   * Stop tracking navigation changes
   */
  stop(): void {
    if (!isBrowser() || this.isDestroyed) return;
    
    logger.debug('Stopping navigation tracking');
    
    // Remove event listener
    if (this.popstateListener) {
      window.removeEventListener('popstate', this.popstateListener);
      this.popstateListener = undefined;
    }
    
    // Restore original methods
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
      this.originalPushState = undefined;
    }
    
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
      this.originalReplaceState = undefined;
    }
    
    this.isDestroyed = true;
  }
  
  /**
   * Check if navigation has occurred
   */
  private checkForNavigation(): void {
    const currentPath = this.getCurrentPath();
    
    if (currentPath !== this.previousPath) {
      logger.debug('Navigation detected', {
        from: this.previousPath,
        to: currentPath,
      });
      
      this.previousPath = currentPath;
      
      try {
        this.handler(currentPath);
      } catch (error) {
        logger.error('Navigation handler error', error);
      }
    }
  }
  
  /**
   * Get current path including search params
   */
  private getCurrentPath(): string {
    if (!isBrowser()) return '';
    return window.location.pathname + window.location.search;
  }
}

/**
 * Create a navigation tracker with automatic cleanup
 */
export function createNavigationTracker(
  handler: NavigationHandler,
  autoStart = true
): { start: () => void; stop: () => void } {
  const tracker = new NavigationTracker(handler);
  
  if (autoStart) {
    tracker.start();
  }
  
  return {
    start: () => tracker.start(),
    stop: () => tracker.stop(),
  };
}