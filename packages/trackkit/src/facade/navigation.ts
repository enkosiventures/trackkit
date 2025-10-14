import { ensureNavigationSandbox } from '../providers/navigation-sandbox';
import { NavigationSource } from '../types';
import { logger } from '../util/logger';

export class NavigationService {
  private unsub: (() => void) | null = null;
  start(onUrl: (url: string) => void) {
    if (typeof window === 'undefined' || this.unsub) return;
    const sandbox = ensureNavigationSandbox(window);
    this.unsub = sandbox.subscribe(onUrl);
    logger.info('Starting autotracking');
  }
  stop() { this.unsub?.(); this.unsub = null; logger.info('Autotracking stopped'); }
}

export function makeWindowNavigationSource(): NavigationSource {
  // SSR / non-DOM safety: expose a no-op source
  if (typeof window === 'undefined' || !('history' in window)) {
    return { subscribe: () => () => {} };
  }

  return {
    subscribe(cb: (url: string) => void): () => void {
      let disposed = false;

      const getUrl = () =>
        window.location.pathname + window.location.search + window.location.hash;

      // De-dupe identical consecutive emissions
      let last = getUrl();

      const emit = () => {
        if (disposed) return;
        const next = getUrl();
        if (next !== last) {
          last = next;
          try { cb(next); } catch { /* swallow subscriber errors */ }
        }
      };

      const onPopState = () => emit();
      const onHashChange = () => emit();

      window.addEventListener('popstate', onPopState);
      window.addEventListener('hashchange', onHashChange);

      // Patch history.* to detect programmatic SPA navigations
      const { pushState, replaceState } = window.history;

      const wrap =
        (original: History['pushState'] | History['replaceState']) =>
        function (this: History, ...args: Parameters<typeof original>) {
          const ret = original.apply(this, args as any);
          // Ensure we run after the URL has changed
          queueMicrotask ? queueMicrotask(emit) : Promise.resolve().then(emit);
          return ret;
        };

      (window.history as any).pushState = wrap(pushState);
      (window.history as any).replaceState = wrap(replaceState);

      // Important: do NOT emit immediately here; initial PV is controlled elsewhere.
      // The facade can call its own `sendInitialPV()` at the appropriate time.

      // Disposer restores original state
      return () => {
        if (disposed) return;
        disposed = true;
        window.removeEventListener('popstate', onPopState);
        window.removeEventListener('hashchange', onHashChange);
        (window.history as any).pushState = pushState;
        (window.history as any).replaceState = replaceState;
      };
    },
  };
}
