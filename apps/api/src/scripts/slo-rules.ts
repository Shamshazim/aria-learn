import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { renderRuleFile } from '@/observability/slo/rules.yaml';
import { SLOS } from '@/observability/slo/slos';

/**
 * `npm run slo:rules -w @aria/api` — writes `infra/alerts/slo-rules.yaml` (X-04).
 *
 * Generated rather than hand-written so the thresholds cannot drift from `slos.ts`, and
 * committed rather than generated at deploy time so a change to a paging threshold arrives as
 * a reviewable diff. `--check` re-renders and compares, which is what CI runs: a pull request
 * that changes an SLO and forgets to regenerate fails there rather than in production.
 */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const RULES_PATH = join(REPO_ROOT, 'infra/alerts/slo-rules.yaml');
const RUNBOOK_DIRECTORY = join(REPO_ROOT, 'infra/alerts/runbooks');

function main(): void {
  const check = process.argv.includes('--check');
  const rendered = renderRuleFile();
  const missing = missingRunbooks();

  if (missing.length > 0) {
    process.stderr.write(
      `Every alerting SLO needs a runbook. Missing: ${missing.join(', ')}\n` +
        `Add infra/alerts/runbooks/<id>.md for each.\n`,
    );
    process.exit(1);
  }

  if (check) {
    const current = read(RULES_PATH);
    if (current === rendered) {
      process.stdout.write('infra/alerts/slo-rules.yaml is up to date\n');
      return;
    }
    process.stderr.write(
      'infra/alerts/slo-rules.yaml is stale. Run `npm run slo:rules -w @aria/api`.\n',
    );
    process.exit(1);
  }

  mkdirSync(dirname(RULES_PATH), { recursive: true });
  writeFileSync(RULES_PATH, rendered, 'utf8');
  process.stdout.write(`Wrote ${RULES_PATH}\n`);
}

/**
 * An alert with no runbook is an alert that wakes somebody with no idea what to do.
 *
 * Checked here rather than reviewed, because the moment it is a convention instead of a build
 * failure it becomes the thing that is skipped on the busy week.
 */
function missingRunbooks(): readonly string[] {
  return SLOS.filter((slo) => slo.status === 'instrumented')
    .map((slo) => slo.id)
    .filter((id) => read(join(RUNBOOK_DIRECTORY, `${id}.md`)) === null);
}

function read(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

main();
