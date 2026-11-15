import { beforeAll, describe, expect, it } from 'vitest';

import { lintRuleIds, warmLint, WARM_LINT_TIMEOUT_MS } from '@/testing/eslint-probe';

describe('raw provider stream import boundary', () => {
  beforeAll(warmLint, WARM_LINT_TIMEOUT_MS);

  it('forbids a child-facing service from consuming LlmProvider.stream directly', async () => {
    const source = `import type { LlmProvider } from '@/ai/provider';
declare const provider: LlmProvider;
void provider.stream({ tier: 'FAST', system: 'x', user: 'x' });`;
    expect(await lintRuleIds(source, 'apps/api/src/services/health.service.ts')).toContain(
      'no-restricted-imports',
    );
  });
});
