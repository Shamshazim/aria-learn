import { beforeAll, describe, expect, it } from 'vitest';

import { lintRuleIds, warmLint, WARM_LINT_TIMEOUT_MS } from '@/testing/eslint-probe';

const IMPORT = `import { EARLY_WORDS } from '@/quality/wordlists/early.data';\nvoid EARLY_WORDS;`;

describe('band wordlists', () => {
  beforeAll(warmLint, WARM_LINT_TIMEOUT_MS);

  it('cannot be imported by the readability gate that replaced them', async () => {
    expect(await lintRuleIds(IMPORT, 'apps/api/src/quality/checks/level.check.ts')).toContain(
      'no-restricted-imports',
    );
  });

  it('stays available to decodable reading text, its one legitimate consumer', async () => {
    expect(
      await lintRuleIds(IMPORT, 'apps/api/src/quality/checks/decodable/decodable.check.ts'),
    ).not.toContain('no-restricted-imports');
  });
});
