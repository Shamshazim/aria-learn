import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const OUTSIDE_CLIENT_PATH = path.join(REPO_ROOT, 'apps/api/src/server.ts');
const SERVICE_PATH = path.join(REPO_ROOT, 'apps/api/src/services/health.service.ts');

describe('AiClient provider seam', () => {
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
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const [result] = await eslint.lintText(source, { filePath: OUTSIDE_CLIENT_PATH });

    expect(result?.messages.map((message) => message.ruleId)).toContain('no-restricted-imports');
  });

  it('allows the composition root to construct the routed provider through its public factory', async () => {
    const source = `import { createRoutedLlmProvider, type RoutedProviderDependencies } from '@/ai/provider';\ndeclare const dependencies: RoutedProviderDependencies;\nvoid createRoutedLlmProvider;\nvoid dependencies;`;
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const [result] = await eslint.lintText(source, { filePath: OUTSIDE_CLIENT_PATH });

    expect(result?.messages.map((message) => message.ruleId)).not.toContain(
      'no-restricted-imports',
    );
  });

  it('rejects routed provider construction outside the composition root', async () => {
    const source = `import { createRoutedLlmProvider } from '@/ai/provider';\nvoid createRoutedLlmProvider;`;
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const [result] = await eslint.lintText(source, { filePath: SERVICE_PATH });

    expect(result?.messages.map((message) => message.ruleId)).toContain('no-restricted-imports');
  });
});
