// import type { NavigationHandler } from './types';
// import { isBrowser } from './browser';
// import { ensureHistorySandbox } from './historySandbox';

// export class NavigationTracker {
//   private handler: NavigationHandler;
//   private previousPath: string;
//   private unsubscribe?: () => void;
//   private isDestroyed = false;

//   constructor(handler: NavigationHandler) {
//     this.handler = handler;
//     this.previousPath = this.getCurrentPath();
//   }

//   private getCurrentPath(): string {
//     if (!isBrowser()) return '/';
//     return window.location.pathname + window.location.search + window.location.hash;
//   }

//   private onUrl = (url: string) => {
//     if (this.isDestroyed) return;
//     if (url !== this.previousPath) {
//       this.previousPath = url;
//       this.handler(url);
//     }
//   };

//   start(): void {
//     if (!isBrowser() || this.isDestroyed || this.unsubscribe) return;
//     this.unsubscribe = ensureHistorySandbox(window).subscribe(this.onUrl);
//   }

//   stop(): void {
//     this.unsubscribe?.();
//     this.unsubscribe = undefined;
//     this.isDestroyed = true;
//   }
// }

// export function createNavigationTracker(handler: NavigationHandler, autoStart = true) {
//   const t = new NavigationTracker(handler);
//   if (autoStart) t.start();
//   return { start: () => t.start(), stop: () => t.stop() };
// }
