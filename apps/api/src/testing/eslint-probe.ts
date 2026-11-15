import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ESLint } from 'eslint';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));

/**
 * One ESLint per test worker, for the tests that prove a lint boundary holds (P3-08-F2).
 *
 * Each of those tests used to build its own `ESLint`, and with type-aware rules every new
 * instance builds a TypeScript program from scratch: about two seconds alone, four or more on a
 * busy machine. One shared instance builds it once; `warmLint()` does that in a hook with room
 * for it, so the tests themselves measure the rule and not the start-up.
 */
let shared: ESLint | null = null;
let warming: Promise<void> | null = null;

function eslint(): ESLint {
  shared ??= new ESLint({ cwd: REPO_ROOT });
  return shared;
}

/** Builds the program once per worker. Call from `beforeAll` with `WARM_LINT_TIMEOUT_MS`. */
export function warmLint(): Promise<void> {
  warming ??= eslint()
    .lintText('export {};\n', { filePath: path.join(REPO_ROOT, 'apps/api/src/server.ts') })
    .then(() => undefined);
  return warming;
}

/**
 * Measured: about 2 s alone, 4.6 s with two full suites running at once — and over 10 s once in
 * a 20-run soak on a busy machine. It is a hang detector, so it is generous.
 */
export const WARM_LINT_TIMEOUT_MS = 30_000;

/** The rule ids ESLint reports for `source` as if it lived at `filePath` (repo-relative). */
export async function lintRuleIds(
  source: string,
  filePath: string,
): Promise<readonly (string | null)[]> {
  const [result] = await eslint().lintText(source, { filePath: path.join(REPO_ROOT, filePath) });
  return result?.messages.map((message) => message.ruleId) ?? [];
}
