import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  {
    ignores: [
      '**/node_modules/**',
      '**/.next/**',
      '**/.env*',
      '**/temp.js',
      '**/.*',
      '**/.swc/**',
      '**/supabase/**',
      '**/__tests__/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/eslint.config.mjs',
    ],
  },

  {
    rules: {
      '@typescript-eslint/naming-convention': [
        'error',
        {
          selector: 'function',
          format: ['camelCase', 'PascalCase'],
        },
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
        },
      ],

      '@typescript-eslint/no-inferrable-types': 'error',
      '@typescript-eslint/no-empty-interface': 'warn',

      'no-console': 'warn',
      'prefer-const': 'error',
      'no-debugger': 'warn',
      'no-duplicate-imports': 'error',
      'no-var': 'error',
      'no-multiple-empty-lines': ['warn', { max: 1 }],
      'no-trailing-spaces': 'warn',
      'no-unreachable': 'error',
      'brace-style': ['error', '1tbs', { allowSingleLine: true }],
    },
  },
];

export default eslintConfig;
