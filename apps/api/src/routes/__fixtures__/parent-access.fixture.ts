import type { ConsentRecordRepository } from '@/repositories/consent-record.repository';
import type { DeletionRequestRepository } from '@/repositories/deletion-request.repository';
import type { DeviceGrantRepository } from '@/repositories/device-grant.repository';
import type { ParentSessionRepository } from '@/repositories/parent-session.repository';
import type {
  ConsentRecord,
  DeletionRequest,
  DeviceGrant,
  DeviceGrantSummary,
  ParentSessionRecord,
} from '@/types/parent-access';

/**
 * In-memory stands-in for the four tables P0-28 adds.
 *
 * Whole repositories, for the reason the P2H-12 fixtures give: the services call several
 * methods in sequence, and a fake implementing only the one a test reaches would pass while
 * the sequence was wrong.
 */
export function fakeDeviceGrants(): DeviceGrantRepository & Readonly<{ rows: Map<string, Grant> }> {
  const rows = new Map<string, Grant>();
  const repository: DeviceGrantRepository = {
    withDb: () => repository,

    insert: (input) => {
      const grant: Grant = {
        id: input.id,
        parentId: input.parentId,
        label: input.label,
        createdAt: input.at,
        lastSeenAt: null,
        revokedAt: null,
        secretHash: input.secretHash,
        studentIds: [...input.studentIds],
      };
      rows.set(grant.id, grant);
      return Promise.resolve(record(grant));
    },

    findActiveBySecretHash: (secretHash) => {
      const grant = [...rows.values()].find(
        (each) => each.secretHash === secretHash && each.revokedAt === null,
      );
      return Promise.resolve(grant === undefined ? null : record(grant));
    },

    permits: (grantId, studentId) =>
      Promise.resolve(rows.get(grantId)?.studentIds.includes(studentId) === true),

    listByParent: (parentId) =>
      Promise.resolve(
        [...rows.values()]
          .filter((grant) => grant.parentId === parentId && grant.revokedAt === null)
          .map((grant): DeviceGrantSummary => ({ ...record(grant), studentIds: grant.studentIds })),
      ),

    touch: (id, at) => {
      const grant = rows.get(id);
      if (grant !== undefined) grant.lastSeenAt = at;
      return Promise.resolve();
    },

    revoke: (id, parentId, at) => {
      const grant = rows.get(id);
      // The parent scope is in the statement in the real repository, so it is here too.
      if (grant?.parentId !== parentId || grant.revokedAt !== null) return Promise.resolve(null);
      grant.revokedAt = at;
      return Promise.resolve(record(grant));
    },
  };
  return Object.assign(repository, { rows });
}

/** Mutable where the real columns are updatable, so the fake can behave like an UPDATE. */
type Grant = Omit<DeviceGrant, 'lastSeenAt' | 'revokedAt'> & {
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  secretHash: string;
  studentIds: string[];
};

function record(grant: Grant): DeviceGrant {
  const { secretHash: _secretHash, studentIds: _studentIds, ...rest } = grant;
  return { ...rest };
}

export function fakeConsentRecords(): ConsentRecordRepository {
  const rows: ConsentRecord[] = [];
  const repository: ConsentRecordRepository = {
    withDb: () => repository,
    insert: (input) => {
      const consent: ConsentRecord = { ...input, grantedAt: input.at, withdrawnAt: null };
      rows.unshift(consent);
      return Promise.resolve(consent);
    },
    findActive: (parentId) =>
      Promise.resolve(
        rows.find((row) => row.parentId === parentId && row.withdrawnAt === null) ?? null,
      ),
    listByParent: (parentId) => Promise.resolve(rows.filter((row) => row.parentId === parentId)),
    withdrawAll: (parentId, at) => {
      let count = 0;
      for (const [index, row] of rows.entries()) {
        if (row.parentId === parentId && row.withdrawnAt === null) {
          rows[index] = { ...row, withdrawnAt: at };
          count += 1;
        }
      }
      return Promise.resolve(count);
    },
  };
  return repository;
}

export function fakeParentSessions(): ParentSessionRepository {
  const rows = new Map<string, MutableParentSession>();
  const repository: ParentSessionRepository = {
    withDb: () => repository,
    upsert: (input) => {
      const existing = rows.get(input.providerSessionId);
      if (existing !== undefined) return Promise.resolve({ ...existing });
      const row = {
        id: input.id,
        parentId: input.parentId,
        providerSessionId: input.providerSessionId,
        issuedAt: input.at,
        lastSeenAt: input.at,
        expiresAt: input.expiresAt,
        revokedAt: null,
      };
      rows.set(row.providerSessionId, row);
      return Promise.resolve({ ...row });
    },
    touch: (id, at) => {
      const row = [...rows.values()].find((each) => each.id === id);
      if (row !== undefined) row.lastSeenAt = at;
      return Promise.resolve();
    },
    revoke: (id, at) => {
      const row = [...rows.values()].find((each) => each.id === id);
      if (row?.revokedAt !== null) return Promise.resolve(false);
      row.revokedAt = at;
      return Promise.resolve(true);
    },
    revokeAllForParent: (parentId, at) => {
      const live = [...rows.values()].filter(
        (row) => row.parentId === parentId && row.revokedAt === null,
      );
      for (const row of live) row.revokedAt = at;
      return Promise.resolve(live.length);
    },
  };
  return repository;
}

type MutableParentSession = Omit<ParentSessionRecord, 'lastSeenAt' | 'revokedAt'> & {
  lastSeenAt: Date;
  revokedAt: Date | null;
};

export function fakeDeletionLedger(): DeletionRequestRepository &
  Readonly<{ rows: Map<string, DeletionRequest> }> {
  const rows = new Map<string, DeletionRequest>();
  const repository: DeletionRequestRepository = {
    withDb: () => repository,
    open: (input) => {
      const row: DeletionRequest = {
        ...input,
        stage: 'requested',
        requestedAt: input.at,
        updatedAt: input.at,
        attempts: 0,
        lastError: null,
      };
      rows.set(row.id, row);
      return Promise.resolve(row);
    },
    advance: (id, stage, at) => {
      const row = rows.get(id);
      if (row !== undefined) rows.set(id, { ...row, stage, updatedAt: at, lastError: null });
      return Promise.resolve();
    },
    fail: (id, reason, at) => {
      const row = rows.get(id);
      if (row !== undefined) {
        rows.set(id, {
          ...row,
          stage: 'failed',
          attempts: row.attempts + 1,
          lastError: reason,
          updatedAt: at,
        });
      }
      return Promise.resolve();
    },
    listUnfinished: (limit) =>
      Promise.resolve([...rows.values()].filter((row) => row.stage !== 'complete').slice(0, limit)),
    findById: (id) => Promise.resolve(rows.get(id) ?? null),
  };
  return Object.assign(repository, { rows });
}
