import { defineConfig } from 'vitest/config';
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: [
      'test/setup/sandbox.ts',
      'test/setup/msw.ts',
      'test/helpers/providers.ts'
    ],
    restoreMocks: true,
    clearMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,
  },
});