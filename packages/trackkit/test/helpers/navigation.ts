import type { NavigationSource } from '../../src/types';
import { tick } from './core';

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
  // Let any pushState wrapping/microtasks settle
  await Promise.resolve();
  window.dispatchEvent(new PopStateEvent('popstate')); // harmless if unused
  // Many SPA routers / our sandbox may schedule a macrotask; yield once.
  await new Promise((r) => setTimeout(r, 0));
}

export const navigateWithTick = async (url: string) => {
  await navigate(url);
  await tick();
};

export function setPath(path: string) {
  window.history.pushState({}, '', path);
}