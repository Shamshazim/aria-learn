import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const PROBE_PATH = path.join(REPO_ROOT, 'apps/api/src/privacy/scrub.type-test.ts');

describe('ScrubbedContext lint boundary', () => {
  it('rejects an aliased double assertion outside the scrubber', async () => {
    const eslint = new ESLint({ cwd: REPO_ROOT });
    const [result] = await eslint.lintText(
      `
import type { RawLearnerContext, ScrubbedContext as SafeContext } from '@/privacy';
declare const raw: RawLearnerContext;
void (raw as unknown as SafeContext);
`,
      { filePath: PROBE_PATH },
    );

    expect(result?.messages.map((message) => message.ruleId)).toContain(
      '@typescript-eslint/no-unsafe-type-assertion',
    );
  });
});
