import { afterEach, beforeEach } from 'vitest';
import { ensureNavigationSandbox } from '../../src/providers/shared/navigationSandbox';

// Import your sandbox to hard reset between tests

beforeEach(() => {
  if (typeof window !== 'undefined') {
    window.history.replaceState({}, '', '/'); // normalize starting URL
  }
});

afterEach(() => {
  try {
    ensureNavigationSandbox(window).__reset(); // tear down patched history + listeners
  } catch {/* no-op */}
});
