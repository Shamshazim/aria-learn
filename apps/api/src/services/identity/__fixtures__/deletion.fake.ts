import type { DeletionRequestRepository } from '@/repositories/deletion-request.repository';
import type { DeviceGrantRepository } from '@/repositories/device-grant.repository';
import type { ParentRepository } from '@/repositories/parent.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { DeletionRequest } from '@/types/deletion';

/**
 * Fakes for the deletion orchestrator's collaborators.
 *
 * Only the methods the orchestrator calls are implemented; the rest throw, so a change that
 * makes it reach for something new fails here rather than passing on a silent stub. The
 * cascades these stand in for are the whole point of the *integration* tests — this file is
 * for the ledger state machine, which is Aria's policy and not Postgres's.
 */
export type DeletionCalls = { erasedParents: string[]; erasedStudents: string[] };

export function createFakeDeletionLedger(): DeletionRequestRepository & {
  rows: readonly DeletionRequest[];
} {
  const rows: DeletionRequest[] = [];
  let counter = 0;

  function update(id: string, change: (row: DeletionRequest) => DeletionRequest): DeletionRequest {
    const index = rows.findIndex((row) => row.id === id);
    const current = rows[index];
    if (current === undefined) throw new Error(`no deletion request ${id}`);
    const next = change(current);
    rows.splice(index, 1, next);
    return next;
  }

  const repository: DeletionRequestRepository & { rows: readonly DeletionRequest[] } = {
    rows,
    withDb: () => repository,

    open: (input) => {
      counter += 1;
      const row: DeletionRequest = {
        id: `deletion-${String(counter)}`,
        stage: 'requested',
        attempts: 0,
        lastError: null,
        requestedAt: new Date(counter),
        completedAt: null,
        ...input,
      };
      rows.push(row);
      return Promise.resolve(row);
    },

    advance: (id, stage) => Promise.resolve(update(id, (row) => ({ ...row, stage }))),

    complete: (id, at) =>
      Promise.resolve(
        update(id, (row) => ({ ...row, stage: 'complete', completedAt: at, lastError: null })),
      ),

    recordFailure: (id, reason) =>
      Promise.resolve(
        update(id, (row) => ({ ...row, attempts: row.attempts + 1, lastError: reason })),
      ),

    listPending: (limit) =>
      Promise.resolve(rows.filter((row) => row.completedAt === null).slice(0, limit)),

    findById: (id) => Promise.resolve(rows.find((row) => row.id === id) ?? null),
  };

  return repository;
}

export function createFakeErasureRepositories(calls: DeletionCalls): {
  grants: DeviceGrantRepository;
  parents: ParentRepository;
  students: StudentRepository;
} {
  const unsupported = (name: string) => (): never => {
    throw new Error(`the deletion orchestrator should not call ${name}`);
  };

  return {
    grants: {
      revokeAllForParent: () => Promise.resolve(1),
      withDb: unsupported('grants.withDb'),
      insert: unsupported('grants.insert'),
      findActiveBySecretHash: unsupported('grants.findActiveBySecretHash'),
      findById: unsupported('grants.findById'),
      listByParentId: unsupported('grants.listByParentId'),
      listProfiles: unsupported('grants.listProfiles'),
      permits: unsupported('grants.permits'),
      touch: unsupported('grants.touch'),
      revoke: unsupported('grants.revoke'),
    },

    parents: {
      deleteById: (id) => {
        calls.erasedParents.push(id);
        return Promise.resolve(true);
      },
      withDb: unsupported('parents.withDb'),
      insert: unsupported('parents.insert'),
      findById: unsupported('parents.findById'),
      findByEmail: unsupported('parents.findByEmail'),
    },

    students: {
      forceDeleteById: (id) => {
        calls.erasedStudents.push(id);
        return Promise.resolve(true);
      },
      withDb: unsupported('students.withDb'),
      insert: unsupported('students.insert'),
      findById: unsupported('students.findById'),
      requireById: unsupported('students.requireById'),
      listByParentId: unsupported('students.listByParentId'),
      deleteById: unsupported('students.deleteById'),
    },
  };
}
