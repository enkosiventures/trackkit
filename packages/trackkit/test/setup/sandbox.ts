import { afterEach, beforeEach } from 'vitest';
import { ensureNavigationSandbox } from '../../src/providers/navigation-sandbox';

// Import sandbox to hard reset between tests
beforeEach(() => {
  const w = (globalThis as any).window;
  if (w && w.history && typeof w.history.replaceState === 'function') {
    w.history.replaceState({}, '', '/');
  }
});

afterEach(() => {
  try {
    ensureNavigationSandbox(window).__reset(); // tear down patched history + listeners
  } catch {/* no-op */}
});
