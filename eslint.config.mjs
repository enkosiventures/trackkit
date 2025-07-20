import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier';

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

  /* -------- Typed TypeScript override ----------------------------- */
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        project: ['./packages/*/tsconfig.json', './packages/trackkit/tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      'no-undef': 'off', // TypeScript handles this
      'no-unused-vars': 'off', // Temporarily for development
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
      globals: {
        process: 'readonly',
      },
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
        vi: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
        process: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        window: 'readonly',
      },
    },
    rules: {}
  },

  /* -------- TypeScript spec files override ------------------------ */
  {
    files: ['**/*.spec.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        sourceType: 'module',
      },
    },
    plugins: { '@typescript-eslint': tseslint },
    rules: {},
  },

  prettier,
];
