import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x';
import { configs as tseslintConfigs } from 'typescript-eslint';

import type { Linter } from 'eslint';

/**
 * The standards in `dev-docs/tickets/CODE-STANDARDS.md`, enforced by the tool rather than by
 * reviewers. Every rule below traces to a numbered section of that document; where the reason
 * is not obvious from the rule name, the comment says which section and why.
 */

/** Never linted, never built, never imported. `legacy/` is frozen (AGENT-INSTRUCTIONS §2). */
const IGNORED = ['node_modules/**', 'legacy/**', '**/dist/**', '**/coverage/**'];

/**
 * §3: dependencies point downward only, and `legacy/` is unreachable from anywhere. Expressed
 * as import patterns so an agent gets an error at the import, not a review comment three days
 * later.
 */
const FORBIDDEN_IMPORT_PATTERNS = [
  {
    group: ['**/legacy/**', 'legacy/**'],
    message: 'legacy/ is frozen: never import from it (AGENT-INSTRUCTIONS §2).',
  },
  {
    // Reaching into another package by path bypasses its public entry point, and with it the
    // module boundary (§4). Traversing *inside* your own package is fine, so this matches the
    // workspace layout rather than counting `../` segments.
    group: ['**/apps/*/src/**', '**/packages/*/src/**'],
    message: 'Import another package through @aria/<name>, never by path (§4, §7).',
  },
];

const typeAwareRules: Linter.RulesRecord = {
  // §1 — `any` is banned in committed code; use `unknown` and narrow.
  '@typescript-eslint/no-explicit-any': 'error',

  // §1 — no `!` to silence the compiler; narrow, or make the type honest.
  '@typescript-eslint/no-non-null-assertion': 'error',

  // §1 — exported functions get explicit return types; inference inside a body is fine.
  '@typescript-eslint/explicit-module-boundary-types': 'error',

  // §1 — `verbatimModuleSyntax` requires type-only imports to be spelled as such.
  '@typescript-eslint/consistent-type-imports': [
    'error',
    { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
  ],
  '@typescript-eslint/consistent-type-definitions': ['error', 'type'],

  // §5 — never swallow an error, and never leave a promise unobserved.
  '@typescript-eslint/no-floating-promises': 'error',
  '@typescript-eslint/no-misused-promises': 'error',

  '@typescript-eslint/no-unused-vars': [
    'error',
    { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
  ],
};

const structuralRules: Linter.RulesRecord = {
  // §2 — the 300-line rule. An error, not a warning, and blank lines and comments count.
  'max-lines': ['error', { max: 300, skipBlankLines: false, skipComments: false }],

  // §2 — a function that needs a section comment is hiding another function.
  'max-lines-per-function': [
    'error',
    { max: 60, skipBlankLines: false, skipComments: false, IIFEs: true },
  ],
  'max-params': ['error', 4],
  'max-depth': ['error', 3],
  complexity: ['error', 12],

  // §4 — no circular imports. CI fails on them.
  'import-x/no-cycle': ['error', { maxDepth: Infinity, ignoreExternal: true }],
  'import-x/no-self-import': 'error',
  'import-x/no-useless-path-segments': ['error', { noUselessIndex: true }],

  // §7 — a stable import order, so diffs stay about behaviour.
  'import-x/order': [
    'error',
    {
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'type'],
      pathGroups: [
        { pattern: '@aria/**', group: 'internal', position: 'before' },
        { pattern: '@/**', group: 'internal', position: 'after' },
      ],
      pathGroupsExcludedImportTypes: ['builtin'],
      'newlines-between': 'always',
      alphabetize: { order: 'asc', caseInsensitive: true },
    },
  ],

  'no-restricted-imports': ['error', { patterns: FORBIDDEN_IMPORT_PATTERNS }],

  // §5 — structured logging only; `console` is not our logging layer.
  'no-console': 'error',

  // §7 — an unfinished-work marker must carry a ticket id, so it cannot hide in the tree.
  'no-warning-comments': ['error', { terms: ['fixme', 'xxx', 'hack'], location: 'anywhere' }],

  eqeqeq: ['error', 'always', { null: 'ignore' }],
  'no-param-reassign': ['error', { props: true }],
  'prefer-const': 'error',
  'no-var': 'error',
};

export default defineConfig([
  globalIgnores(IGNORED),

  js.configs.recommended,
  tseslintConfigs.strictTypeChecked,
  tseslintConfigs.stylisticTypeChecked,
  importXConfigs.recommended,
  importXConfigs.typescript,

  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        // Resolves each file against the nearest tsconfig, so per-package settings apply.
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver({ alwaysTryTypes: true })],
    },
    rules: { ...typeAwareRules, ...structuralRules },
  },

  {
    // Config files compose tools rather than application layers, so the boundary rule that
    // keeps an app from reaching outside its package does not apply to them.
    files: ['*.config.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  // Last, so formatting never fights the rules above (§7).
  prettier,
]);
