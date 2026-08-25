import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettier from 'eslint-config-prettier';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import { flatConfigs as importXConfigs } from 'eslint-plugin-import-x';
import { configs as tseslintConfigs } from 'typescript-eslint';

import type { Linter } from 'eslint';

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
    group: ['**/apps/*/src/**', '**/packages/*/src/**'],
    message: 'Import another package through @aria/<name>, never by path (§4, §7).',
  },
];

const PROVIDER_INTERNAL_IMPORT_PATTERN = {
  group: ['@/ai/provider/adapters/**', '**/ai/provider/adapters/**'],
  message: 'Vendor adapters are internal; depend on the routed provider entry point (P0-13).',
};

const PROVIDER_PUBLIC_IMPORT_RESTRICTION = {
  name: '@/ai/provider',
  allowImportNames: [
    'AiConfig',
    'AiConfigError',
    'LoadAiConfigOptions',
    'LlmResponse',
    'ModelTier',
    'aiConfigSchema',
    'loadAiConfig',
  ],
  message: 'Only ai-client.ts may depend on or call the LlmProvider port (P0-14).',
};

const PROVIDER_COMPOSITION_IMPORT_RESTRICTION = {
  ...PROVIDER_PUBLIC_IMPORT_RESTRICTION,
  allowImportNames: [
    ...PROVIDER_PUBLIC_IMPORT_RESTRICTION.allowImportNames,
    'RoutedProviderDependencies',
    'bootstrapRoutedProvider',
    'createNamedEndpointProvider',
    'createRoutedLlmProvider',
  ],
};

const PROVIDER_STREAMING_IMPORT_RESTRICTION = {
  ...PROVIDER_PUBLIC_IMPORT_RESTRICTION,
  allowImportNames: [
    ...PROVIDER_PUBLIC_IMPORT_RESTRICTION.allowImportNames,
    'LlmProvider',
    'LlmRequest',
    'StreamChunk',
  ],
};

const PROVIDER_PRIVATE_IMPORT_PATTERN = {
  group: ['@/ai/provider/**', '**/ai/provider/**'],
  message: 'Provider internals are private to ai/provider and ai-client.ts (P0-14).',
};

const typeAwareRules: Linter.RulesRecord = {
  '@typescript-eslint/no-explicit-any': 'error',

  '@typescript-eslint/no-non-null-assertion': 'error',

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
      // Every workspace tsconfig, so the `@/*` alias each app declares actually resolves.
      // Without the project list the resolver only sees the root config and reports every
      // aliased import as unresolved.
      'import-x/resolver-next': [
        createTypeScriptImportResolver({
          alwaysTryTypes: true,
          project: ['tsconfig.json', 'apps/*/tsconfig.json', 'packages/*/tsconfig.json'],
        }),
      ],
    },
    rules: { ...typeAwareRules, ...structuralRules },
  },

  {
    files: ['*.config.ts'],
    rules: { 'no-restricted-imports': 'off' },
  },

  {
    // Attaching per-request context to `req` is how Express middleware works — it is the
    // framework's mechanism, not an accidental mutation of a caller's object. The rule still
    // applies to every other parameter (P0-03).
    files: ['apps/api/**/*.ts'],
    rules: {
      'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['req'] }],
    },
  },

  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    ignores: ['apps/web/src/api/client.ts', 'apps/web/src/**/*.test.*', 'apps/web/src/test/**'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'fetch', message: 'Use the typed API client instead of fetch (P0-05).' },
      ],
    },
  },

  {
    files: ['apps/api/src/**/*.ts'],
    ignores: [
      'apps/api/src/ai/provider/**/*.ts',
      'apps/api/src/ai/client/ai-client.ts',
      'apps/api/src/ai/streaming/**/*.ts',
      'apps/api/src/ai/runtime.ts',
      'apps/api/src/testing/golden/live-source.ts',
      'apps/api/src/server.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [PROVIDER_PUBLIC_IMPORT_RESTRICTION],
          patterns: [
            ...FORBIDDEN_IMPORT_PATTERNS,
            PROVIDER_INTERNAL_IMPORT_PATTERN,
            PROVIDER_PRIVATE_IMPORT_PATTERN,
          ],
        },
      ],
    },
  },

  {
    files: [
      'apps/api/src/server.ts',
      'apps/api/src/ai/runtime.ts',
      'apps/api/src/testing/golden/live-source.ts',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [PROVIDER_COMPOSITION_IMPORT_RESTRICTION],
          patterns: [
            ...FORBIDDEN_IMPORT_PATTERNS,
            PROVIDER_INTERNAL_IMPORT_PATTERN,
            PROVIDER_PRIVATE_IMPORT_PATTERN,
          ],
        },
      ],
    },
  },

  {
    files: ['apps/api/src/ai/client/ai-client.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...FORBIDDEN_IMPORT_PATTERNS,
            PROVIDER_INTERNAL_IMPORT_PATTERN,
            PROVIDER_PRIVATE_IMPORT_PATTERN,
          ],
        },
      ],
    },
  },

  {
    files: ['apps/api/src/ai/streaming/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [PROVIDER_STREAMING_IMPORT_RESTRICTION],
          patterns: [
            ...FORBIDDEN_IMPORT_PATTERNS,
            PROVIDER_INTERNAL_IMPORT_PATTERN,
            PROVIDER_PRIVATE_IMPORT_PATTERN,
          ],
        },
      ],
    },
  },

  {
    // P0-23: the brand is constructed once in scrub.ts. Type-aware assertion checking catches
    // aliases and indirect type expressions, not just the written name `ScrubbedContext`.
    files: ['apps/api/src/**/*.ts'],
    ignores: ['apps/api/src/privacy/scrub.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-type-assertion': 'error',
    },
  },

  {
    // `describe` and `it` read as blocks, not as functions, and the 60-line ceiling exists to
    // stop a function doing several jobs — which a suite is supposed to do. The 300-line file
    // rule still applies, so a suite that grows past that still has to be split (P0-04).
    files: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'max-lines-per-function': 'off' },
  },

  prettier,
]);
