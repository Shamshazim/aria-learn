import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));
const LEVEL_CHECK_PATH = path.join(REPO_ROOT, 'apps/api/src/quality/checks/level.check.ts');
const DECODABLE_PATH = path.join(
  REPO_ROOT,
  'apps/api/src/quality/checks/decodable/decodable.check.ts',
);

const IMPORT = `import { EARLY_WORDS } from '@/quality/wordlists/early.data';\nvoid EARLY_WORDS;`;

async function ruleIds(filePath: string): Promise<readonly (string | null)[]> {
  const eslint = new ESLint({ cwd: REPO_ROOT });
  const [result] = await eslint.lintText(IMPORT, { filePath });
  return result?.messages.map((message) => message.ruleId) ?? [];
}

describe('band wordlists', () => {
  it('cannot be imported by the readability gate that replaced them', async () => {
    expect(await ruleIds(LEVEL_CHECK_PATH)).toContain('no-restricted-imports');
  }, 15_000);

  it('stays available to decodable reading text, its one legitimate consumer', async () => {
    expect(await ruleIds(DECODABLE_PATH)).not.toContain('no-restricted-imports');
  }, 15_000);
});
