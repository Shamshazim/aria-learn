import { BRIEF_PERIODS, type BriefPeriod } from '@aria/shared';

import { loadAiConfig } from '@/ai/provider';
import { createAiRuntime } from '@/ai/runtime';
import { loadRepoEnvFile, readConfig } from '@/config';
import { outputSafety } from '@/content/output-safety';
import { createInventoryService } from '@/curriculum';
import { closePool, createPool } from '@/db';
import { systemClock } from '@/lib/clock';
import { uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { createQualityGate } from '@/quality';
import { createBriefEvidenceRepository } from '@/repositories/brief-evidence.repository';
import { createLearnerBriefRepository } from '@/repositories/learner-brief.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import { createLearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import { createSkillStateRepository } from '@/repositories/skill-state.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import { createBriefService } from '@/services/brief/brief.service';
import { briefIsSafe } from '@/services/brief/safety';

/**
 * `npm run brief:generate -w @aria/api -- --student <id> --period week [--at 2026-11-10]`
 *
 * Writes a new version of one child's brief for the period containing `--at` (today when
 * absent). There is no scheduler on purpose (P3-03): cron or CI calls this, and a second run
 * for the same period simply writes the next version.
 */
async function main(): Promise<void> {
  const args = parse(process.argv.slice(2));
  loadRepoEnvFile();
  const aiConfig = loadAiConfig(process.env);
  const config = readConfig();
  const logger = createLogger({ level: config.logLevel });
  const pool = createPool(config.database, logger);
  try {
    const ai = await createAiRuntime({
      aiConfig,
      appConfig: config,
      db: pool,
      ids: uuidGenerator,
      clock: systemClock,
      logger,
      fetch: globalThis.fetch,
    });
    const inventory = createInventoryService();
    const gate = createQualityGate(outputSafety);
    const ids = uuidGenerator;
    const brief = createBriefService({
      sources: {
        facts: createLearnerMemoryRepository({ db: pool, ids }),
        episodes: createLearnerEpisodeRepository({ db: pool, ids }),
        skills: createSkillStateRepository({ db: pool, clock: systemClock }),
        sessions: createBriefEvidenceRepository(pool),
        skillName: (code) => inventory.getSkill(code)?.name ?? null,
      },
      briefs: createLearnerBriefRepository({ db: pool, ids }),
      students: createStudentRepository({ db: pool, ids }),
      ai: ai.client,
      safe: (text) => briefIsSafe(gate, text),
      clock: systemClock,
      logger,
    });
    const written = await brief.generate({
      studentId: args.student,
      period: args.period,
      periodStart: args.at,
    });
    process.stdout.write(
      written === null
        ? 'No brief written: nothing to say for that period.\n'
        : `${JSON.stringify({ id: written.id, version: written.version, generator: written.generator, body: written.body }, null, 2)}\n`,
    );
  } finally {
    await closePool(pool, logger);
  }
}

type Args = Readonly<{ student: string; period: BriefPeriod; at: Date }>;

function parse(argv: readonly string[]): Args {
  const value = (flag: string): string | undefined => {
    const index = argv.indexOf(flag);
    return index === -1 ? undefined : argv[index + 1];
  };
  const student = value('--student');
  const period = BRIEF_PERIODS.find((candidate) => candidate === (value('--period') ?? 'week'));
  const at = value('--at');
  if (student === undefined || period === undefined) {
    throw new Error(
      'Usage: brief:generate -- --student <id> --period week|month|year [--at YYYY-MM-DD]',
    );
  }
  return { student, period, at: at === undefined ? new Date() : new Date(`${at}T12:00:00Z`) };
}

await main();
