import { beforeAll, describe, expect, it } from 'vitest';

import { lintRuleIds, warmLint, WARM_LINT_TIMEOUT_MS } from '@/testing/eslint-probe';

const OUTSIDE_CLIENT_PATH = 'apps/api/src/server.ts';
const SERVICE_PATH = 'apps/api/src/services/health.service.ts';

describe('AiClient provider seam', () => {
  beforeAll(warmLint, WARM_LINT_TIMEOUT_MS);

  it.each([
    {
      name: 'port type',
      source: `import type { LlmProvider } from '@/ai/provider';\ndeclare const value: LlmProvider;\nvoid value;`,
    },
    {
      name: 'namespace bypass',
      source: `import * as provider from '@/ai/provider';\nvoid provider;`,
    },
    {
      name: 'private routing module',
      source: `import { createRoutedLlmProvider } from '@/ai/provider/routing';\nvoid createRoutedLlmProvider;`,
    },
  ])('rejects $name outside ai-client.ts', async ({ source }) => {
    expect(await lintRuleIds(source, OUTSIDE_CLIENT_PATH)).toContain('no-restricted-imports');
  });

  it('allows the composition root to construct the routed provider through its public factory', async () => {
    const source = `import { createRoutedLlmProvider, type RoutedProviderDependencies } from '@/ai/provider';\ndeclare const dependencies: RoutedProviderDependencies;\nvoid createRoutedLlmProvider;\nvoid dependencies;`;
    expect(await lintRuleIds(source, OUTSIDE_CLIENT_PATH)).not.toContain('no-restricted-imports');
  });

  it('rejects routed provider construction outside the composition root', async () => {
    const source = `import { createRoutedLlmProvider } from '@/ai/provider';\nvoid createRoutedLlmProvider;`;
    expect(await lintRuleIds(source, SERVICE_PATH)).toContain('no-restricted-imports');
  });
});
