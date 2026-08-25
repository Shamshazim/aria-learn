import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildVoiceGoldenReport } from './report';
import { voiceCandidateResultSchema } from './result.schema';

const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const DEFAULT_RESULT = path.join(REPO_ROOT, 'dev-docs/golden/voice/results/synthetic-smoke.json');

async function main(): Promise<void> {
  const resultPath =
    process.argv[2] === undefined ? DEFAULT_RESULT : path.resolve(REPO_ROOT, process.argv[2]);
  const parsed = voiceCandidateResultSchema.parse(JSON.parse(await readFile(resultPath, 'utf8')));
  const report = buildVoiceGoldenReport(parsed);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.eligibleForProviderDecision) process.exitCode = 1;
}

void main();
