import { ForbiddenError, NotFoundError } from '@/errors';
import type { AdultIdentityProvider } from '@/identity';
import type { Clock } from '@/lib/clock';
import type { Logger } from '@/lib/logger';
import type { AdultIdentityRepository } from '@/repositories/adult-identity.repository';
import type { AdultSessionRepository } from '@/repositories/adult-session.repository';
import type { DeletionRequestRepository } from '@/repositories/deletion-request.repository';
import type { DeviceGrantRepository } from '@/repositories/device-grant.repository';
import type { ParentRepository } from '@/repositories/parent.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { DeletionRequest } from '@/types/deletion';
import type { AdultActor } from '@/types/identity';

/**
 * One deletion orchestrator, in the order P0-26 fixed:
 *
 *   1. write the ledger row, so the intent survives everything that follows;
 *   2. revoke every device grant and every Aria session, so nothing can act mid-deletion;
 *   3. delete the Aria rows, which cascades through the children and their whole history;
 *   4. hard-delete the adult at the identity provider;
 *   5. mark the ledger row complete.
 *
 * Steps 3 and 4 are two systems and cannot be one transaction, which is the whole reason the
 * ledger exists. A failure at step 4 leaves a durable `local_deleted` row: the child data is
 * already gone, the vendor identity is not, and `replayPending` finishes the job — including
 * after a restore from backup, the one moment deleted rows can reappear.
 *
 * The vendor call is idempotent by contract, so replaying a request that actually succeeded
 * costs a round trip and changes nothing.
 */
export type DeletionService = Readonly<{
  /** Erasure of an adult and everything they own. Requires a freshly verified adult session. */
  deleteAdult(actor: AdultActor): Promise<DeletionRequest>;
  /** Retries every unfinished request, oldest first. Safe to run repeatedly. */
  replayPending(limit?: number): Promise<readonly DeletionRequest[]>;
}>;

export type DeletionServiceDeps = Readonly<{
  provider: AdultIdentityProvider;
  identities: AdultIdentityRepository;
  adultSessions: AdultSessionRepository;
  grants: DeviceGrantRepository;
  parents: ParentRepository;
  students: StudentRepository;
  deletions: DeletionRequestRepository;
  clock: Clock;
  logger: Logger;
}>;

const DEFAULT_REPLAY_LIMIT = 50;

export function createDeletionService(deps: DeletionServiceDeps): DeletionService {
  return {
    deleteAdult: (actor) => deleteAdult(deps, actor),
    replayPending: (limit = DEFAULT_REPLAY_LIMIT) => replayPending(deps, limit),
  };
}

async function deleteAdult(deps: DeletionServiceDeps, actor: AdultActor): Promise<DeletionRequest> {
  // The one action where an unexpired token is not enough: P0-26 requires a fresh adult
  // verification before anything irreversible, and this is the most irreversible thing the
  // product does.
  if (!actor.freshlyVerified) {
    throw new ForbiddenError(`adult ${actor.adultId} deletion requires a fresh verification`);
  }

  const identity = await deps.identities.findById(actor.adultId);
  if (identity === null) throw new NotFoundError(`adult identity ${actor.adultId} not found`);

  const request = await deps.deletions.open({
    subjectKind: 'adult',
    subjectId: identity.id,
    provider: identity.provider,
    providerSubject: identity.providerSubject,
  });

  await eraseLocally(deps, identity.id, identity.parentId);
  return finish(deps, await deps.deletions.advance(request.id, 'local_deleted'));
}

async function replayPending(
  deps: DeletionServiceDeps,
  limit: number,
): Promise<readonly DeletionRequest[]> {
  const pending = await deps.deletions.listPending(limit);
  const settled: DeletionRequest[] = [];

  for (const request of pending) {
    // A request that never got past step 1 has to redo steps 2 and 3 first: the process died
    // before the local rows were gone, or the ledger is being replayed onto a restore that
    // still has them.
    const ready = request.stage === 'requested' ? await redoLocal(deps, request) : request;
    settled.push(await finish(deps, ready));
  }

  return settled;
}

/** Steps 2 and 3: nothing can act, then nothing is left. */
async function eraseLocally(
  deps: DeletionServiceDeps,
  adultId: string,
  parentId: string | null,
): Promise<void> {
  const now = deps.clock.now();
  await deps.adultSessions.revokeAllForAdult(adultId, now);
  if (parentId === null) return;

  await deps.grants.revokeAllForParent(parentId, now);
  // The cascade from `parent` is what carries the children, their sessions, their grants and
  // every learning row with it — master-plan.md §12.9, expressed as schema rather than as a
  // cleanup script somebody has to remember to run.
  await deps.parents.deleteById(parentId);
}

/** Step 4, and the only step that can fail without losing work. */
async function finish(
  deps: DeletionServiceDeps,
  request: DeletionRequest,
): Promise<DeletionRequest> {
  if (request.providerSubject === null) {
    return deps.deletions.complete(request.id, deps.clock.now());
  }

  try {
    await deps.provider.deleteUser(request.providerSubject);
    return await deps.deletions.complete(request.id, deps.clock.now());
  } catch (error) {
    deps.logger.error(
      { err: error, deletionRequestId: request.id, attempts: request.attempts },
      'identity provider deletion failed; request stays pending for replay',
    );
    return deps.deletions.recordFailure(request.id, describe(error));
  }
}

/**
 * Redoes the local half of a request that died before finishing it. Every step it takes is
 * idempotent, which is what lets a replay run against a database that got halfway, a database
 * that got nowhere, and a restore from backup that undid the lot.
 */
async function redoLocal(
  deps: DeletionServiceDeps,
  request: DeletionRequest,
): Promise<DeletionRequest> {
  if (request.subjectKind === 'child') {
    await deps.students.forceDeleteById(request.subjectId);
    return deps.deletions.advance(request.id, 'local_deleted');
  }

  const identity = await deps.identities.findById(request.subjectId);
  // Absent means the local rows are already gone — the deletion got that far before dying.
  if (identity !== null) await eraseLocally(deps, identity.id, identity.parentId);
  return deps.deletions.advance(request.id, 'local_deleted');
}

/** The vendor's message, for an operator, truncated by the repository before it is stored. */
function describe(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : 'unknown failure';
}
