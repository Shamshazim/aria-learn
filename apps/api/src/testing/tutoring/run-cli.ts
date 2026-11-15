import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createHarnessTutor, runTutoringGoldenSet } from '@/testing/tutoring';

const REPO_ROOT = fileURLToPath(new URL('../../../../../', import.meta.url));

function readScenarioArgument(arguments_: readonly string[]): string | undefined {
  const index = arguments_.indexOf('--scenario');
  if (index === -1) return undefined;
  const value = arguments_[index + 1];
  if (value === undefined || value.startsWith('--')) {
    throw new Error('--scenario requires a scenario id.');
  }
  return value;
}

async function main(): Promise<void> {
  const outputDirectory = path.join(REPO_ROOT, '.cache/golden/tutoring');
  const scenario = readScenarioArgument(process.argv.slice(2));
  // P3-08: "--scenario phase3/*" runs one group; anything else is a single scenario id.
  const group = scenario === undefined ? null : (/^([a-z0-9-]+)\/\*$/u.exec(scenario)?.[1] ?? null);
  const scenarioId = group === null ? scenario : undefined;
  const scenarios = path.join(REPO_ROOT, 'dev-docs/golden/tutoring/scenarios');
  const report = await runTutoringGoldenSet({
    scenarioDirectory: group === null ? scenarios : path.join(scenarios, group),
    outputDirectory,
    tutorFactory: createHarnessTutor,
    ...(scenarioId === undefined ? {} : { scenarioId }),
  });
  const status = report.passed ? 'PASS' : 'FAIL';
  process.stdout.write(`${status}: ${String(report.scenarios.length)} tutoring scenario(s).\n`);
  process.stdout.write(`Transcripts: ${outputDirectory}\n`);
  if (!report.passed) process.exitCode = 1;
}

await main();
