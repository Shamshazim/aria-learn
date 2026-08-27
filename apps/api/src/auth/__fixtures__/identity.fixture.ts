import type { ChildCredentialRepository } from '@/repositories/child-credential.repository';
import type { ChildSessionRepository } from '@/repositories/child-session.repository';
import type { ChildCredential, ChildSessionRecord } from '@/types/auth';

import type { SecretHasher } from '../secret-hasher';

/**
 * In-memory stand-ins for the two tables identity adds.
 *
 * Whole repositories rather than partial fakes: the services under test call several methods
 * in sequence — issue, touch, revoke — and a fake that only implements the one a test happens
 * to reach would pass while the sequence was wrong.
 */
export function fakeChildSessions(): ChildSessionRepository & Readonly<{ rows: Map<string, Row> }> {
  const rows = new Map<string, Row>();
  const repository: ChildSessionRepository = {
    withDb: () => repository,
    insert: (input) => Promise.resolve(insert(rows, input)),

    findLiveByTokenHash: (tokenHash, now) => {
      const row = [...rows.values()].find(
        (each) => each.tokenHash === tokenHash && live(each, now),
      );
      return Promise.resolve(row === undefined ? null : record(row));
    },

    touch: (id, at) => {
      const row = rows.get(id);
      if (row !== undefined) row.lastSeenAt = at;
      return Promise.resolve();
    },

    rotate: (id, tokenHash, at) => {
      const row = rows.get(id);
      if (row === undefined || !live(row, at)) return Promise.resolve(null);
      row.tokenHash = tokenHash;
      row.lastSeenAt = at;
      return Promise.resolve(record(row));
    },

    revoke: (id, at) => {
      const row = rows.get(id);
      if (row?.revokedAt !== null) return Promise.resolve(false);
      row.revokedAt = at;
      return Promise.resolve(true);
    },

    revokeAllForParent: (parentId, at) =>
      Promise.resolve(revokeWhere(rows, at, (row) => row.parentId === parentId)),

    revokeAllForStudent: (studentId, at) =>
      Promise.resolve(revokeWhere(rows, at, (row) => row.studentId === studentId)),

    findExpired: (now, idleCutoff, limit) =>
      Promise.resolve(
        [...rows.values()]
          .filter((row) => row.revokedAt === null)
          .filter((row) => row.expiresAt <= now || row.lastSeenAt <= idleCutoff)
          .slice(0, limit)
          .map(record),
      ),
  };
  return { ...repository, rows };
}

function live(row: Row, now: Date): boolean {
  return row.revokedAt === null && row.expiresAt > now;
}

function insert(
  rows: Map<string, Row>,
  input: Parameters<ChildSessionRepository['insert']>[0],
): ChildSessionRecord {
  const row: Row = {
    id: input.id,
    studentId: input.studentId,
    parentId: input.parentId,
    tokenHash: input.tokenHash,
    issuedAt: input.issuedAt,
    lastSeenAt: input.issuedAt,
    expiresAt: input.expiresAt,
    revokedAt: null,
    deviceLabel: input.deviceLabel,
  };
  if ([...rows.values()].some((each) => each.tokenHash === row.tokenHash)) {
    throw new Error('child_session_token_hash_key');
  }
  rows.set(row.id, row);
  return record(row);
}

type Row = ChildSessionRecord & { tokenHash: string; lastSeenAt: Date; revokedAt: Date | null };

function record(row: Row): ChildSessionRecord {
  const { tokenHash: _tokenHash, ...rest } = row;
  return { ...rest };
}

function revokeWhere(
  rows: Map<string, Row>,
  at: Date,
  matches: (row: Row) => boolean,
): readonly ChildSessionRecord[] {
  const affected = [...rows.values()].filter((row) => row.revokedAt === null && matches(row));
  for (const row of affected) row.revokedAt = at;
  return affected.map(record);
}

export function fakeChildCredentials(
  seed: Partial<ChildCredential> = {},
): ChildCredentialRepository {
  let row: ChildCredential = {
    studentId: 'student-1',
    pinHash: null,
    pictureHash: null,
    familyDevice: false,
    failedAttempts: 0,
    lockedUntil: null,
    ...seed,
  };
  const repository: ChildCredentialRepository = {
    withDb: () => repository,
    find: () => Promise.resolve(row),
    upsert: (input) => {
      row = {
        ...row,
        ...(input.pinHash === undefined ? {} : { pinHash: input.pinHash }),
        ...(input.pictureHash === undefined ? {} : { pictureHash: input.pictureHash }),
        ...(input.familyDevice === undefined ? {} : { familyDevice: input.familyDevice }),
        failedAttempts: 0,
        lockedUntil: null,
      };
      return Promise.resolve(row);
    },
    recordFailure: (_studentId, _at, lockedUntil) => {
      row = { ...row, failedAttempts: row.failedAttempts + 1, lockedUntil };
      return Promise.resolve();
    },
    clearFailures: () => {
      row = { ...row, failedAttempts: 0, lockedUntil: null };
      return Promise.resolve();
    },
  };
  return repository;
}

/** Reversible, instant, and obviously not a hash — a test asserting on it says so. */
export const plainHasher: SecretHasher = {
  hash: (secret) => Promise.resolve(`hashed:${secret}`),
  verify: (stored, secret) => Promise.resolve(stored === `hashed:${secret}`),
};
