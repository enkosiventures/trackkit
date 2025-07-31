import type { NavigationSource } from '../../src/types';

export interface TestNavigationSource extends NavigationSource {
  /** Drive a URL change (unit tests only). */
  __push(url: string): void;
}

/** In-memory navigation source for unit tests (no globals, deterministic). */
export function makeMemoryNavSource(): TestNavigationSource {
  const subs = new Set<(url: string) => void>();
  return {
    subscribe(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    __push(url: string) {
      for (const cb of subs) cb(url);
    },
  };
}

export async function navigate(url: string) {
  window.history.pushState({}, '', url);
  // If your sandbox dispatches on patched pushState via queueMicrotask, a microtask flush is enough:
  await Promise.resolve(); // flush microtasks
  // For extra safety (older code listening to popstate), include:
  window.dispatchEvent(new PopStateEvent('popstate'));
}