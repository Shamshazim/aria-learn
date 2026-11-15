import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { evaluatePhase3Exit } from '@aria/tutor';

import { readConfigOrExit } from '@/config';
import { closePool, createPool, verifyConnection } from '@/db';
import { createLogger } from '@/lib/logger';
import { readArrivalBench } from '@/observability/report/phase3/bench';
import { assembleEvidence } from '@/observability/report/phase3/collect';
import { formatPhase3Report } from '@/observability/report/phase3/format';
import {
  collectGoldenEvidence,
  NO_GOLDEN_EVIDENCE,
} from '@/observability/report/phase3/golden.collector';
import { readObservations } from '@/observability/report/phase3/observations';
import { createPhase3EvidenceRepository } from '@/repositories/phase3-evidence.repository';

/**
 * `npm run phase3:report -w @aria/api` (P3-08): collects the Phase 3 exit evidence, runs the
 * gate, writes both to `.cache/phase3/report.json` and prints one line per criterion. Exits
 * non-zero until the phase passes, so CI can hold Phase 4 behind it.
 */
const REPO_ROOT = fileURLToPath(new URL('../../../../', import.meta.url));
const OUTPUT = path.join(REPO_ROOT, '.cache/phase3/report.json');

const config = readConfigOrExit();
const logger = createLogger({ level: config.logLevel });
const pool = createPool(config.database, logger);
const now = new Date();

try {
  const database = await verifyConnection(pool)
    .then(() => createPhase3EvidenceRepository(pool).load())
    .catch((error: unknown) => {
      logger.info(
        { error: String(error) },
        'phase3: database unreachable; its criteria are missing',
      );
      return null;
    });
  const golden = await collectGoldenEvidence(
    path.join(REPO_ROOT, 'dev-docs/golden/tutoring/scenarios'),
  ).catch(() => NO_GOLDEN_EVIDENCE);
  const evidence = assembleEvidence({
    at: now,
    database,
    golden,
    arrivalP95Ms: await readArrivalBench(
      path.join(REPO_ROOT, '.cache/phase3/arrival-bench.json'),
      now,
    ),
    human: await readObservations(path.join(REPO_ROOT, 'dev-docs/phase3-observations.json')),
  });
  const report = evaluatePhase3Exit(evidence);
  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, `${JSON.stringify({ evidence, report }, null, 2)}\n`);
  process.stdout.write(`${formatPhase3Report(report)}\nWritten: ${OUTPUT}\n`);
  if (!report.passed) process.exitCode = 1;
} finally {
  await closePool(pool, logger);
}
