import type { ProviderDirectory } from '@/auth/provider-directory';
import { NotFoundError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { Logger } from '@/lib/logger';
import type { ConsentRecordRepository } from '@/repositories/consent-record.repository';
import type { DeletionRequestRepository } from '@/repositories/deletion-request.repository';
import type { ParentRepository } from '@/repositories/parent.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { DeletionRequest } from '@/types/parent-access';

/**
 * Erasing a child, or a whole family (P0-28, master-plan.md §12.9).
 *
 * Two systems have to forget: our database and the identity provider. Neither can be rolled
 * back once the other has run, so the only honest implementation is a ledger. Write the
 * intent; erase locally; tell the vendor; mark it done. A crash between any two of those
 * leaves a row that says exactly how far it got, and `replay` finishes it.
 *
 * "Delete means delete" is a promise about the end state, not about a single request
 * succeeding. This is what lets us keep it when the vendor is down.
 */
export type DeletionService = Readonly<{
  /** One child. The cascades in the schema do the rest of the work. */
  deleteChild(input: Readonly<{ parentId: string; studentId: string }>): Promise<DeletionRequest>;
  /** The parent, their children, and the provider user behind them. */
  deleteAccount(input: Readonly<{ parentId: string }>): Promise<DeletionRequest>;
  /** Picks up everything unfinished. Safe to run repeatedly; that is the point of it. */
  replay(limit?: number): Promise<Readonly<{ finished: number; failed: number }>>;
}>;

export type DeletionServiceDeps = Readonly<{
  ledger: DeletionRequestRepository;
  students: Pick<StudentRepository, 'deleteById' | 'listByParentId'>;
  parents: Pick<ParentRepository, 'findById' | 'deleteById'>;
  consents: Pick<ConsentRecordRepository, 'withdrawAll'>;
  directory: ProviderDirectory;
  clock: Clock;
  ids: IdGenerator;
  logger: Logger;
}>;

const REPLAY_LIMIT = 50;

export function createDeletionService(deps: DeletionServiceDeps): DeletionService {
  return {
    deleteChild: (input) => deleteChild(deps, input),
    deleteAccount: (input) => deleteAccount(deps, input),
    replay: (limit = REPLAY_LIMIT) => replay(deps, limit),
  };
}

async function deleteChild(
  deps: DeletionServiceDeps,
  input: Readonly<{ parentId: string; studentId: string }>,
): Promise<DeletionRequest> {
  const request = await deps.ledger.open({
    id: deps.ids.next(),
    subjectKind: 'child',
    subjectId: input.studentId,
    parentId: input.parentId,
    // A child is not a provider user. Nothing to delete on the vendor's side, which is why
    // this one reaches `complete` in a single step.
    providerSubject: null,
    at: deps.clock.now(),
  });

  // `parent_id` is in the DELETE, so a child belonging to another family is simply not
  // deleted — the request 404s rather than erasing somebody else's row.
  const deleted = await deps.students.deleteById(input.studentId, input.parentId);
  if (!deleted) {
    await fail(deps, request, 'child not found for this parent');
    throw new NotFoundError(`student ${input.studentId} not found for parent ${input.parentId}`);
  }

  return finish(deps, request);
}

async function deleteAccount(
  deps: DeletionServiceDeps,
  input: Readonly<{ parentId: string }>,
): Promise<DeletionRequest> {
  const parent = await deps.parents.findById(input.parentId);
  if (parent === null) throw new NotFoundError(`parent ${input.parentId} not found`);

  // The provider subject is captured *before* anything is erased. Afterwards there is no row
  // left to read it from, and a ledger entry that cannot name the vendor user is one the
  // replay can never finish.
  const request = await deps.ledger.open({
    id: deps.ids.next(),
    subjectKind: 'account',
    subjectId: input.parentId,
    parentId: input.parentId,
    providerSubject: parent.supabaseUserId,
    at: deps.clock.now(),
  });

  await eraseLocally(deps, input.parentId);
  await deps.ledger.advance(request.id, 'local_deleted', deps.clock.now());

  return deleteFromProvider(deps, { ...request, stage: 'local_deleted' });
}

/**
 * Local erasure. The cascades on `parent` take the children, sessions, credentials, grants and
 * consent records with it — which is why this is one statement and not a list of them.
 */
async function eraseLocally(deps: DeletionServiceDeps, parentId: string): Promise<void> {
  await deps.consents.withdrawAll(parentId, deps.clock.now());
  await deps.parents.deleteById(parentId);
}

/** The vendor half. Separated so the replay can enter here without repeating the local half. */
async function deleteFromProvider(
  deps: DeletionServiceDeps,
  request: DeletionRequest,
): Promise<DeletionRequest> {
  if (request.providerSubject === null) return finish(deps, request);

  try {
    await deps.directory.deleteUser(request.providerSubject);
  } catch (error) {
    // Not rethrown. The local data is already gone, which is the part the parent asked for
    // and the part that matters; the ledger keeps the vendor half owed and the replay
    // collects it. Failing the request here would tell a parent their deletion did not
    // happen, which would be false.
    await fail(deps, request, reasonFor(error));
    deps.logger.error(
      { deletionRequestId: request.id, err: error },
      'identity provider deletion failed; left in the ledger for replay',
    );
    return { ...request, stage: 'failed' };
  }

  return finish(deps, request);
}

async function finish(
  deps: DeletionServiceDeps,
  request: DeletionRequest,
): Promise<DeletionRequest> {
  const at = deps.clock.now();
  await deps.ledger.advance(request.id, 'complete', at);
  return { ...request, stage: 'complete', updatedAt: at };
}

async function fail(
  deps: DeletionServiceDeps,
  request: DeletionRequest,
  reason: string,
): Promise<void> {
  await deps.ledger.fail(request.id, reason, deps.clock.now());
}

async function replay(
  deps: DeletionServiceDeps,
  limit: number,
): Promise<Readonly<{ finished: number; failed: number }>> {
  const unfinished = await deps.ledger.listUnfinished(limit);
  let finished = 0;
  let failed = 0;

  for (const request of unfinished) {
    const outcome = await resume(deps, request);
    if (outcome.stage === 'complete') finished += 1;
    else failed += 1;
  }

  return { finished, failed };
}

/**
 * Picking one row up from wherever it stopped.
 *
 * A row still at `requested` had its local erasure interrupted, so that is redone — the
 * statements are idempotent, and deleting an already-deleted row is a no-op rather than an
 * error. Anything further along only owes the vendor call.
 */
async function resume(
  deps: DeletionServiceDeps,
  request: DeletionRequest,
): Promise<DeletionRequest> {
  if (request.stage === 'requested') {
    if (request.subjectKind === 'child') {
      await deps.students.deleteById(request.subjectId, request.parentId);
      return finish(deps, request);
    }
    await eraseLocally(deps, request.parentId);
    await deps.ledger.advance(request.id, 'local_deleted', deps.clock.now());
  }

  return deleteFromProvider(deps, request);
}

/** Our words, never the vendor's body: it can carry an email address. */
function reasonFor(error: unknown): string {
  return error instanceof Error ? error.name : 'unknown error';
}
