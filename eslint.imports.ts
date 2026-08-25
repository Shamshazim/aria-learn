/**
 * Import boundaries, as lint rules.
 *
 * They live in their own module so `eslint.config.ts` stays under the 300-line rule it
 * enforces (CODE-STANDARDS §2). Each constant is a boundary the architecture depends on; the
 * comment on it says which ticket decided it.
 */
/**
 * §3: dependencies point downward only, and `legacy/` is unreachable from anywhere. Expressed
 * as import patterns so an agent gets an error at the import, not a review comment three days
 * later.
 */
export const FORBIDDEN_IMPORT_PATTERNS = [
  {
    group: ['**/legacy/**', 'legacy/**'],
    message: 'legacy/ is frozen: never import from it (AGENT-INSTRUCTIONS §2).',
  },
  {
    group: ['**/apps/*/src/**', '**/packages/*/src/**'],
    message: 'Import another package through @aria/<name>, never by path (§4, §7).',
  },
];

export const PROVIDER_INTERNAL_IMPORT_PATTERN = {
  group: ['@/ai/provider/adapters/**', '**/ai/provider/adapters/**'],
  message: 'Vendor adapters are internal; depend on the routed provider entry point (P0-13).',
};

export const PROVIDER_PUBLIC_IMPORT_RESTRICTION = {
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

export const PROVIDER_COMPOSITION_IMPORT_RESTRICTION = {
  ...PROVIDER_PUBLIC_IMPORT_RESTRICTION,
  allowImportNames: [
    ...PROVIDER_PUBLIC_IMPORT_RESTRICTION.allowImportNames,
    'RoutedProviderDependencies',
    'bootstrapRoutedProvider',
    'createNamedEndpointProvider',
    'createRoutedLlmProvider',
  ],
};

export const PROVIDER_STREAMING_IMPORT_RESTRICTION = {
  ...PROVIDER_PUBLIC_IMPORT_RESTRICTION,
  allowImportNames: [
    ...PROVIDER_PUBLIC_IMPORT_RESTRICTION.allowImportNames,
    'LlmProvider',
    'LlmRequest',
    'StreamChunk',
  ],
};

export const PROVIDER_PRIVATE_IMPORT_PATTERN = {
  group: ['@/ai/provider/**', '**/ai/provider/**'],
  message: 'Provider internals are private to ai/provider and ai-client.ts (P0-14).',
};

/**
 * P2H-02: the per-band vocabulary whitelists no longer decide whether a child hears a
 * sentence — readability does. They survive only as phonics data for decodable reading text
 * (P4-02), so importing one anywhere else silently reintroduces the gate we just removed.
 */
export const WORDLIST_IMPORT_PATTERN = {
  group: ['@/quality/wordlists/**', '**/quality/wordlists/**'],
  message:
    'The band wordlists are phonics data for decodable text only; the readability gate replaced them (P2H-02).',
};
