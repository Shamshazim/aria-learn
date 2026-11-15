import { beforeAll, describe, expect, it } from 'vitest';

import { lintRuleIds, warmLint, WARM_LINT_TIMEOUT_MS } from '@/testing/eslint-probe';

describe('ScrubbedContext lint boundary', () => {
  beforeAll(warmLint, WARM_LINT_TIMEOUT_MS);

  it('rejects an aliased double assertion outside the scrubber', async () => {
    const source = `
import type { RawLearnerContext, ScrubbedContext as SafeContext } from '@/privacy';
declare const raw: RawLearnerContext;
void (raw as unknown as SafeContext);
`;
    expect(await lintRuleIds(source, 'apps/api/src/privacy/scrub.type-test.ts')).toContain(
      '@typescript-eslint/no-unsafe-type-assertion',
    );
  });
});
