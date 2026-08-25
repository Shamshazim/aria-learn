import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { optionalDate } from '@/mappers/identity.mapper';

/**
 * The child's picture credential and its attempt throttle.
 *
 * Split from `student.repository.ts` by responsibility rather than by table (CODE-STANDARDS
 * §2): that repository is the child *profile* the product reads, this one is the *credential*
 * the sign-in path checks. Keeping them apart means the hash and the failure counters are
 * selected by exactly two statements, both in this file, and never ride along on a query some
 * unrelated feature wrote.
 *
 * Four pictures is a small keyspace by necessity, so the online guard is here: attempts are
 * counted on the row and a profile locks itself rather than answering forever.
 */
export type StudentCredential = {
  studentId: string;
  parentId: string;
  /** Null when no picture secret has been set, which means the profile cannot be opened. */
  secretHash: string | null;
  failedAttempts: number;
  lockedUntil: Date | null;
};

export type StudentCredentialRepository = {
  withDb(db: Queryable): StudentCredentialRepository;
  find(studentId: string): Promise<StudentCredential | null>;
  setSecret(input: {
    studentId: string;
    parentId: string;
    secretHash: string;
    avatarKey: string | null;
  }): Promise<boolean>;
  /** Increments the counter and locks the profile once it reaches `maxAttempts`. */
  recordFailure(input: {
    studentId: string;
    at: Date;
    maxAttempts: number;
    lockoutMs: number;
  }): Promise<{ lockedUntil: Date | null }>;
  clearFailures(studentId: string): Promise<void>;
};

/** Every statement this repository can issue, in one block — see `student.repository.ts`. */
const SQL = {
  find: `SELECT id, parent_id, picture_secret_hash, failed_secret_attempts, locked_until
         FROM student
         WHERE id = $1`,

  setSecret: `UPDATE student
              SET picture_secret_hash = $3,
                  avatar_key = COALESCE($4, avatar_key),
                  failed_secret_attempts = 0,
                  locked_until = NULL
              WHERE id = $1 AND parent_id = $2`,

  // Counted and locked in one statement, so two devices guessing at once cannot both read a
  // stale count and each get a full allowance. The CASE is what makes the lock atomic with
  // the increment rather than a second round trip that could be lost.
  recordFailure: `UPDATE student
                  SET failed_secret_attempts = failed_secret_attempts + 1,
                      locked_until = CASE
                        WHEN failed_secret_attempts + 1 >= $3
                        THEN $2::timestamptz + make_interval(secs => $4::double precision)
                        ELSE locked_until
                      END
                  WHERE id = $1
                  RETURNING locked_until`,

  clearFailures: `UPDATE student SET failed_secret_attempts = 0, locked_until = NULL WHERE id = $1`,
} as const;

type CredentialRow = {
  id: string;
  parent_id: string;
  picture_secret_hash: string | null;
  failed_secret_attempts: number;
  locked_until: Date | null;
};

export type StudentCredentialRepositoryDeps = {
  db: Queryable;
};

export function createStudentCredentialRepository(
  deps: StudentCredentialRepositoryDeps,
): StudentCredentialRepository {
  const { db } = deps;

  return {
    withDb: (next) => createStudentCredentialRepository({ ...deps, db: next }),
    find: (studentId) => find(db, studentId),
    setSecret: (input) => setSecret(db, input),
    recordFailure: (input) => recordFailure(db, input),
    clearFailures: async (studentId) => {
      await runQuery({
        db,
        operation: 'studentCredential.clearFailures',
        sql: SQL.clearFailures,
        params: [studentId],
      });
    },
  };
}

async function find(db: Queryable, studentId: string): Promise<StudentCredential | null> {
  const { rows } = await runQuery<CredentialRow>({
    db,
    operation: 'studentCredential.find',
    sql: SQL.find,
    params: [studentId],
  });

  const row = rows[0];
  if (!row) return null;

  return {
    studentId: row.id,
    parentId: row.parent_id,
    secretHash: row.picture_secret_hash,
    failedAttempts: row.failed_secret_attempts,
    lockedUntil: optionalDate(row.locked_until, 'student', 'locked_until', row.id),
  };
}

async function setSecret(
  db: Queryable,
  input: { studentId: string; parentId: string; secretHash: string; avatarKey: string | null },
): Promise<boolean> {
  const { rowCount } = await runQuery({
    db,
    operation: 'studentCredential.setSecret',
    sql: SQL.setSecret,
    params: [input.studentId, input.parentId, input.secretHash, input.avatarKey],
  });
  return (rowCount ?? 0) > 0;
}

async function recordFailure(
  db: Queryable,
  input: { studentId: string; at: Date; maxAttempts: number; lockoutMs: number },
): Promise<{ lockedUntil: Date | null }> {
  const { rows } = await runQuery<{ locked_until: Date | null }>({
    db,
    operation: 'studentCredential.recordFailure',
    sql: SQL.recordFailure,
    // Seconds, because `make_interval` takes them and the policy is expressed in milliseconds.
    params: [input.studentId, input.at, input.maxAttempts, input.lockoutMs / 1000],
  });

  const row = rows[0];
  return {
    lockedUntil: row
      ? optionalDate(row.locked_until, 'student', 'locked_until', input.studentId)
      : null,
  };
}
