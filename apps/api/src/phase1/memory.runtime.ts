import { createBriefEvidenceRepository } from '@/repositories/brief-evidence.repository';
import { createCorrectionTargetRepository } from '@/repositories/correction-target.repository';
import { createFactCorrectionRepository } from '@/repositories/fact-correction.repository';
import { createLearnerBriefRepository } from '@/repositories/learner-brief.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import { createBriefService } from '@/services/brief/brief.service';
import type { BriefService } from '@/services/brief/types';
import { createBriefInvalidation } from '@/services/memory/correct/invalidate';
import type { CorrectionStores } from '@/services/memory/correct/types';
import {
  createChildCorrectionService,
  createParentCorrectionService,
  type ChildCorrectionService,
  type ParentCorrectionService,
} from '@/services/memory/correct.service';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

/** P3-03 and P3-06: the learner brief, and the corrections that make it stale. */
export type MemoryRuntime = Readonly<{
  brief: BriefService;
  childCorrections: ChildCorrectionService;
  parentCorrections(
    requireOwned: (parentId: string, childId: string) => Promise<unknown>,
  ): ParentCorrectionService;
}>;

export function buildMemoryRuntime(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
  extras: Readonly<{ skillName(code: string): string | null; safe(text: string): boolean }>,
): MemoryRuntime {
  const episodes = createLearnerEpisodeRepository({ db: deps.pool, ids: deps.ids });
  const brief = createBriefService({
    sources: {
      facts: repositories.memory,
      episodes,
      skills: repositories.skills,
      sessions: createBriefEvidenceRepository(deps.pool),
      skillName: extras.skillName,
    },
    briefs: createLearnerBriefRepository({ db: deps.pool, ids: deps.ids }),
    students: repositories.students,
    ai: deps.ai,
    safe: extras.safe,
    clock: deps.clock,
    logger: deps.logger,
  });
  const stores: CorrectionStores = {
    facts: repositories.memory,
    episodes,
    corrections: createFactCorrectionRepository({ db: deps.pool, ids: deps.ids }),
    targets: createCorrectionTargetRepository(deps.pool),
  };
  const shared = {
    stores,
    ids: deps.ids,
    clock: deps.clock,
    invalidateBrief: createBriefInvalidation({
      logger: deps.logger,
      regenerate: (studentId, at) => brief.generate({ studentId, period: 'week', periodStart: at }),
      schedule: deps.scheduleBackground ?? runSoon,
    }),
  };
  return {
    brief,
    childCorrections: createChildCorrectionService({ ...shared, logger: deps.logger }),
    parentCorrections: (requireOwned) =>
      createParentCorrectionService({
        ...shared,
        pool: deps.pool,
        requireOwned,
        metrics: deps.metrics,
      }),
  };
}

function runSoon(task: () => Promise<void>): void {
  queueMicrotask(() => {
    void task();
  });
}
