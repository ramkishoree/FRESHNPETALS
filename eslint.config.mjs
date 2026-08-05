// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.turbo/**',
      '**/dist/**',
      '**/coverage/**',
      'apps/**',
      'INTRO PRD',
      'INTRO PRD1',
    ],
  },
  js.configs.recommended,
  // Type-aware linting for actual package source code only — config files
  // (vitest.config.ts, this file, etc.) aren't part of any tsconfig "include".
  {
    files: ['packages/*/src/**/*.ts'],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  // Non-type-aware linting for tooling/config files.
  {
    files: ['*.config.{js,mjs,ts}', 'packages/*/*.config.{js,mjs,ts}'],
    extends: [...tseslint.configs.recommended],
  },
  // Node CLI scripts (migration runner, seed loader, release tooling) —
  // run directly with `node`, not through any tsconfig.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        Buffer: 'readonly',
      },
    },
  },
);
