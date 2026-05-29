/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  extends: [
    'next/core-web-vitals',
    'plugin:@typescript-eslint/strict-type-checked',
    'plugin:@typescript-eslint/stylistic-type-checked',
    'plugin:jsx-a11y/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  plugins: ['@typescript-eslint', 'jsx-a11y'],
  rules: {
    // TypeScript strict rules (from rules/typescriptrules.md)
    '@typescript-eslint/no-explicit-any': 'error',
    // TODO: Restore to 'error' after pnpm db:gen-types generates proper types.
    // Manual Database types cause `any` to leak through Supabase .from() chains.
    '@typescript-eslint/no-unsafe-argument': 'warn',
    '@typescript-eslint/no-unsafe-assignment': 'warn',
    '@typescript-eslint/no-unsafe-call': 'warn',
    '@typescript-eslint/no-unsafe-member-access': 'warn',
    '@typescript-eslint/no-unsafe-return': 'warn',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/explicit-function-return-type': [
      'warn',
      {
        allowExpressions: true,
        allowTypedFunctionExpressions: true,
      },
    ],
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/await-thenable': 'error',
    '@typescript-eslint/no-misused-promises': ['error', { checksVoidReturn: { attributes: false } }],

    // Relax rules that fight manual Database types (remove after pnpm db:gen-types)
    '@typescript-eslint/no-unnecessary-type-assertion': 'warn',
    '@typescript-eslint/no-unnecessary-condition': 'warn',
    '@typescript-eslint/dot-notation': 'warn',
    '@typescript-eslint/restrict-template-expressions': ['warn', { allowNumber: true }],
    '@typescript-eslint/non-nullable-type-assertion-style': 'warn',
    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/no-dynamic-delete': 'warn',
    '@typescript-eslint/prefer-optional-chain': 'warn',
    '@typescript-eslint/no-base-to-string': 'warn',
    '@typescript-eslint/prefer-regexp-exec': 'warn',
    '@typescript-eslint/prefer-nullish-coalescing': 'warn',
    '@typescript-eslint/consistent-indexed-object-style': 'warn',
    '@typescript-eslint/no-unnecessary-type-conversion': 'warn',

    // Relax some strict-type-checked rules that conflict with Next.js patterns
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-confusing-void-expression': 'off',
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'scripts/',
    'supabase/',
    'kb/',
    'tiers/',
    'rules/',
    '*.config.*',
    '*.mjs',
  ],
};
