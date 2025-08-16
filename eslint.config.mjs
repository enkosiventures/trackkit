import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  /* -------- Global ignore globs (replaces .eslintignore) ---------- */
  {
    ignores: [
      '**/dist/**',    // build output
      '**/*.d.ts',     // generated declaration bundles
      'coverage/**',   // vitest coverage output (if any)
      'node_modules/**'
    ]
  },
  
  /* -------- JS recommended rules ---------------------------------- */
  {
    ...js.configs.recommended,
    languageOptions: { globals: { console: 'readonly', require: 'readonly' } },
  },

  /* -------- Typed TypeScript for PRODUCTION code ------------------ */
  {
    files: ['packages/**/src/**/*.{ts,tsx}'],
    languageOptions: {
      parser,
      parserOptions: {
        project: [
          './packages/*/tsconfig.json',
          './packages/trackkit/tsconfig.eslint.json'
        ],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      // Base interop:
      'no-undef': 'off',

      // Useful, type-aware rules:
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],
      '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
      '@typescript-eslint/no-unsafe-argument': 'off', // relax if adapters need it
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },

  /* -------- Config-file override (untyped) ------------------------ */
  {
    files: ['**/*.config.ts', '**/*.config.mts', '**/*.config.mjs', '**/*.mjs'],
    languageOptions: {
      parser,
      parserOptions: {
        sourceType: 'module',
        project: null
      },
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {},
  },

  /* -------- TypeScript test files override ------------------------ */
  {
    files: ['**/*.test.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        project: ['./packages/*/tsconfig.test.json'],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
      globals: {
        // Vitest
        vi: 'readonly', expect: 'readonly', describe: 'readonly', it: 'readonly',
        beforeAll: 'readonly', afterAll: 'readonly', beforeEach: 'readonly', afterEach: 'readonly',
        // Node
        ...globals.node,
        // Browser/DOM (jsdom)
        ...globals.browser,
        // Extra DOM-ish globals used in tests
        PopStateEvent: 'readonly',
        HashChangeEvent: 'readonly',
        Response: 'readonly',
        Request: 'readonly',
        RequestInit: 'readonly',
        Headers: 'readonly',
      },
    },
    rules: {
      'no-undef': 'off',          // TS + jsdom provide these at runtime
      'no-empty': 'off',          // allow empty spies/handlers in tests
      'no-unused-vars': 'off',    // test helpers often leave vars around
      '@typescript-eslint/no-unused-vars': 'off',
    }
  },

  /* -------- TypeScript spec files override ------------------------ */
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        sourceType: 'module',
      },
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-undef': 'off',
      'no-empty': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },

  prettier,
];
