import js from '@eslint/js';
import parser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default [
  /* -------- Global ignore globs ---------------------------------- */
  {
    ignores: [
      '**/cache/**',
      '**/dist/**',
      '**/*.d.ts',
      '**/coverage/**',
      'node_modules/**',
    ],
  },

  /* -------- Base JS (applies to everything unless overridden) ---- */
  {
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.node,
        console: 'readonly',
        require: 'readonly',
        process: 'readonly',
      },
    },
    rules: {
      // For plain JS files
      'no-unused-vars': ['warn', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
    },
  },

  /* -------- TypeScript (project-wide; non-test) ------------------ */
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        // No project here — faster non-type-aware lint for app code
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      // Turn off core, use the TS variant
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        args: 'after-used',
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrors: 'all',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],

      // Common TS rules you likely want:
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }],
      // Avoid noise for async handlers like addEventListener
      // '@typescript-eslint/no-misused-promises': ['warn', {
      //   checksVoidReturn: { attributes: false },
      // }],

      // no-undef is redundant for TS
      'no-undef': 'off',
    },
  },

  /* -------- TypeScript tests (type-aware) ------------------------ */
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      parser,
      parserOptions: {
        project: ['./packages/*/tsconfig.test.json'],
        tsconfigRootDir: new URL('.', import.meta.url).pathname,
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
        vi: 'readonly',
        expect: 'readonly',
        describe: 'readonly',
        it: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
        ignoreRestSiblings: true,
      }],
      'no-undef': 'off',
      // '@typescript-eslint/no-misused-promises': ['warn', {
      //   checksVoidReturn: { attributes: false },
      // }],
    },
  },

  /* -------- Config .mjs/.mts/.ts (untyped to avoid project reqs) - */
  {
    files: ['**/*.config.ts', '**/*.config.mts', '**/*.config.mjs', '**/*.mjs'],
    languageOptions: {
      parser,
      parserOptions: { sourceType: 'module' },
      globals: {
        ...globals.node,
        process: 'readonly',
      },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'off',
    },
  },

  // Keep Prettier last to disable stylistic conflict rules
  prettier,
];
