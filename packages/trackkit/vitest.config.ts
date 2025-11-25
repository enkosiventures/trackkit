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
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'json-summary'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/dist/**',
        '**/*.d.ts',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
      ],
      thresholds: {
        statements: 90,
        lines: 90,
        functions: 90,
        branches: 80,
      },
    },
  },
});