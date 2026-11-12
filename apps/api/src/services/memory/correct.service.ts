import type { CorrectionAuthor } from '@aria/shared';
import type { SelfCorrection } from '@aria/tutor';

import { withTransaction } from '@/db/transaction';
import type { Queryable } from '@/db/types';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import type { Metrics } from '@/observability/metrics';
import { applyCorrection } from '@/services/memory/correct/apply';
import { childCorrectionRequest } from '@/services/memory/correct/from-child';
import type { BriefInvalidation } from '@/services/memory/correct/invalidate';
import type {
  CorrectionRequest,
  CorrectionResult,
  CorrectionStores,
} from '@/services/memory/correct/types';

import type { Pool } from 'pg';

/** The counter `master-plan.md` §11's "parent corrections reflected next session" is read from. */
export const PARENT_CORRECTION_TOTAL = 'memory_correction_parent_total';

/**
 * A parent correcting their own child's memory (P3-06). A child who is not theirs, and a
 * memory that is not that child's, are the same 404 as a random id: a probe learns nothing.
 */
export type ParentCorrectionService = Readonly<{
  correct(
    input: Readonly<{ parentId: string; childId: string; request: CorrectionRequest }>,
  ): Promise<CorrectionResult>;
}>;

/**
 * A child correcting themselves mid-lesson, inside the turn's own transaction. `null` when the
 * claim matched nothing Aria remembers — the child is still acknowledged.
 */
export type ChildCorrectionService = Readonly<{
  fromChild(
    tx: Queryable,
    input: Readonly<{ studentId: string; correction: SelfCorrection }>,
  ): Promise<CorrectionResult | null>;
  /**
   * The week brief is stale once the change is committed — not before, or the rebuild would
   * read the fact the child just corrected. The turn calls this after its transaction ends.
   */
  afterCommit(studentId: string, result: CorrectionResult): Promise<void>;
}>;

type CorrectionDeps = Readonly<{
  stores: CorrectionStores;
  ids: IdGenerator;
  clock: Clock;
  invalidateBrief: BriefInvalidation;
}>;

export function createParentCorrectionService(
  deps: CorrectionDeps &
    Readonly<{
      pool: Pool;
      /** Throws `NotFoundError` unless the child is this parent's (`ParentChildrenService`). */
      requireOwned(parentId: string, childId: string): Promise<unknown>;
      metrics?: Pick<Metrics, 'increment'>;
    }>,
): ParentCorrectionService {
  return {
    correct: async ({ parentId, childId, request }) => {
      await deps.requireOwned(parentId, childId);
      const author = { correctedBy: 'parent', correctedById: parentId } as const;
      const result = await withTransaction(deps.pool, (tx) =>
        apply(deps, tx, { studentId: childId, author, request }),
      );
      if (result.correctionId !== null) {
        deps.metrics?.increment(PARENT_CORRECTION_TOTAL, {
          change: `${request.targetKind}:${request.action}`,
        });
        await invalidate(deps, childId, result.correctionId);
      }
      return result;
    },
  };
}

export function createChildCorrectionService(
  deps: CorrectionDeps & Readonly<{ logger: Pick<Logger, 'info'> }>,
): ChildCorrectionService {
  return {
    fromChild: async (tx, { studentId, correction }) => {
      const current = await deps.stores.facts.withDb(tx).listCurrent(studentId, deps.clock.now());
      const request = childCorrectionRequest(correction, current);
      if (request === null) {
        deps.logger.info(
          { event: 'memory.correction.child_unmatched', studentId, kind: correction.kind },
          'A child corrected something Aria does not remember; nothing changed',
        );
        return null;
      }
      const author = { correctedBy: 'child', correctedById: null } as const;
      return apply(deps, tx, { studentId, author, request });
    },
    afterCommit: async (studentId, result) => {
      if (result.correctionId !== null) await invalidate(deps, studentId, result.correctionId);
    },
  };
}

function apply(
  deps: CorrectionDeps,
  tx: Queryable,
  input: Readonly<{ studentId: string; author: CorrectionAuthor; request: CorrectionRequest }>,
): Promise<CorrectionResult> {
  return applyCorrection(bind(deps.stores, tx), { ...input, now: deps.clock.now(), ids: deps.ids });
}

function invalidate(deps: CorrectionDeps, studentId: string, correctionId: string): Promise<void> {
  return deps.invalidateBrief({ studentId, correctionId, at: deps.clock.now() });
}

function bind(stores: CorrectionStores, tx: Queryable): CorrectionStores {
  return {
    facts: stores.facts.withDb(tx),
    episodes: stores.episodes.withDb(tx),
    corrections: stores.corrections.withDb(tx),
    targets: stores.targets.withDb(tx),
  };
}
