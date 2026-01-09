import { configDefaults, defineConfig } from 'vitest/config';
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
    exclude: [
      ...configDefaults.exclude,
      '**/e2e/**',
    ],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'json-summary'],
      all: true,
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        '**/e2e/**',
        '**/dist/**',
        '**/*.d.ts',
        'src/**/e2e/**',
        'src/**/index.ts',
        'src/**/types.ts',
        'src/**/fixtures/**',
        'src/**/__mocks__/**',
        'src/**/__fixtures__/**',
        '**/node_modules/**',
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