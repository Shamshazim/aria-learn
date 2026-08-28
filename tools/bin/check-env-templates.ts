import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

import {
  compareTemplates,
  duplicateNames,
  formatDrift,
  hasDrift,
  readEnvNames,
} from '../env/templates';

/**
 * `npm run check:env`.
 *
 * Holds `infra/environments/*.env.example` to `.env.example`, by name. A key that boot
 * refuses to start without, missing from the template an operator fills in, is a deploy that
 * fails at 3am for a reason nobody can see from the repository (X-01).
 */
const REFERENCE = '.env.example';
const TEMPLATE_DIR = path.join('infra', 'environments');

/**
 * Variables a deployment has and a laptop does not. Declared here rather than inferred, so
 * that adding one is a decision somebody made in a diff.
 */
const DEPLOYMENT_ONLY = [
  // Set by the platform, read by nothing in the workspace; present so the templates document
  // the shape of a real environment rather than only the shape of a developer's.
  'PORT',
  'FLY_APP_NAME',
  'FLY_REGION',
  'PRIMARY_REGION',
];

function main(): void {
  const reference = readEnvNames(readFileSync(REFERENCE, 'utf8'));
  const problems: string[] = [];

  const repeated = duplicateNames(reference);
  if (repeated.length > 0) problems.push(`${REFERENCE} declares twice: ${repeated.join(', ')}`);

  for (const file of readdirSync(TEMPLATE_DIR).filter((name) => name.endsWith('.env.example'))) {
    const full = path.join(TEMPLATE_DIR, file);
    const names = readEnvNames(readFileSync(full, 'utf8'));

    const repeatedHere = duplicateNames(names);
    if (repeatedHere.length > 0)
      problems.push(`${full} declares twice: ${repeatedHere.join(', ')}`);

    const drift = compareTemplates(reference, names, DEPLOYMENT_ONLY);
    if (hasDrift(drift)) problems.push(formatDrift(full, drift));
  }

  if (problems.length === 0) {
    process.stdout.write(`Environment templates match ${REFERENCE}.\n`);
    return;
  }

  process.stderr.write(
    `${problems.join('\n')}\n\n` +
      `Every variable the workspace reads belongs in ${REFERENCE} and in each environment ` +
      'template, by name and with no value (CODE-STANDARDS §8).\n',
  );
  process.exitCode = 1;
}

main();
