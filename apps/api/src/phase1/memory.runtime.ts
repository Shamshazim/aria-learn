import { createCorrectionTargetRepository } from '@/repositories/correction-target.repository';
import { createFactCorrectionRepository } from '@/repositories/fact-correction.repository';
import { createLearnerEpisodeRepository } from '@/repositories/learner-episode.repository';
import { createBriefInvalidation } from '@/services/memory/correct/invalidate';
import type { CorrectionStores } from '@/services/memory/correct/types';
import {
  createChildCorrectionService,
  createParentCorrectionService,
  type ChildCorrectionService,
  type ParentCorrectionService,
} from '@/services/memory/correct.service';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';

/** P3-06: the memory corrections, for the parent route and for the child's own turn. */
function correctionDeps(deps: Phase1RuntimeDeps, repositories: Phase1Repositories) {
  const stores: CorrectionStores = {
    facts: repositories.memory,
    episodes: createLearnerEpisodeRepository({ db: deps.pool, ids: deps.ids }),
    corrections: createFactCorrectionRepository({ db: deps.pool, ids: deps.ids }),
    targets: createCorrectionTargetRepository(deps.pool),
  };
  return {
    stores,
    ids: deps.ids,
    clock: deps.clock,
    invalidateBrief: createBriefInvalidation(deps.logger),
  };
}

export function childCorrections(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
): ChildCorrectionService {
  return createChildCorrectionService({
    ...correctionDeps(deps, repositories),
    logger: deps.logger,
  });
}

export function parentCorrections(
  deps: Phase1RuntimeDeps,
  repositories: Phase1Repositories,
  requireOwned: (parentId: string, childId: string) => Promise<unknown>,
): ParentCorrectionService {
  return createParentCorrectionService({
    ...correctionDeps(deps, repositories),
    pool: deps.pool,
    requireOwned,
    metrics: deps.metrics,
  });
}
