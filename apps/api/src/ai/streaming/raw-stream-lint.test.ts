import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const CHILD_SERVICE = path.join(REPO_ROOT, 'apps/api/src/services/health.service.ts');

describe('raw provider stream import boundary', () => {
  it('forbids a child-facing service from consuming LlmProvider.stream directly', async () => {
    const source = `import type { LlmProvider } from '@/ai/provider';
declare const provider: LlmProvider;
void provider.stream({ tier: 'FAST', system: 'x', user: 'x' });`;
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const [result] = await eslint.lintText(source, { filePath: CHILD_SERVICE });

    expect(result?.messages.map((message) => message.ruleId)).toContain('no-restricted-imports');
  });
});
