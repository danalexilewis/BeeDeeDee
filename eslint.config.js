import js from '@eslint/js';
import unusedImports from 'eslint-plugin-unused-imports';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/*.tsbuildinfo',
      '.kiro/**',
      'packages/behavior-web/src/components/ui/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'unused-imports': unusedImports,
    },
    rules: {
      'unused-imports/no-unused-imports': 'error',
      '@typescript-eslint/no-unused-vars': 'off',
      'unused-imports/no-unused-vars': [
        'warn',
        {
          vars: 'all',
          varsIgnorePattern: '^_',
          args: 'after-used',
          argsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
      '@typescript-eslint/no-explicit-any': 'warn',

      // The plan mandates factory functions over classes.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message: 'Use factory functions returning plain objects instead of classes.',
        },
      ],

      // Domain and application layers must never throw; they return Result.
      'prefer-promise-reject-errors': 'error',
    },
  },
  {
    // Error subclasses are the one legitimate use of `class` in this codebase,
    // and only where an Error instance must cross a library boundary.
    files: ['**/*-error.ts', '**/errors/*.ts'],
    rules: {
      'no-restricted-syntax': 'off',
    },
  },
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.prop.test.ts', 'e2e/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    // Build scripts run under plain Node, so they need its globals declared. The
    // TypeScript sources get them from @types/node instead.
    files: ['**/scripts/**/*.mjs', '**/scripts/**/*.js'],
    languageOptions: {
      globals: {
        process: 'readonly',
        console: 'readonly',
      },
    },
  }
);
