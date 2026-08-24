import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const OUTSIDE_CLIENT_PATH = path.join(REPO_ROOT, 'apps/api/src/server.ts');

describe('AiClient provider seam', () => {
  it.each([
    {
      name: 'port type',
      source: `import type { LlmProvider } from '@/ai/provider';\ndeclare const value: LlmProvider;\nvoid value;`,
    },
    {
      name: 'routed factory',
      source: `import { createRoutedLlmProvider } from '@/ai/provider';\nvoid createRoutedLlmProvider;`,
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
});
