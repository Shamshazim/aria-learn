import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { toChildCredential, type ChildCredentialRow } from '@/mappers/child.mapper';
import type { ChildCredential } from '@/types/auth';

/**
 * How a child proves they are themselves (P2H-12).
 *
 * Separate from `student` on purpose: the profile is read on every arrival and every turn,
 * and none of those reads has any business carrying a password hash. The lockout counters
 * live here too, because they are written on failure and a failed login must not touch the
 * row the tutor is reading.
 */
const COLUMNS = 'student_id, pin_hash, picture_hash, family_device, failed_attempts, locked_until';

export type ChildCredentialRepository = Readonly<{
  withDb(db: Queryable): ChildCredentialRepository;
  find(studentId: string): Promise<ChildCredential | null>;
  /**
   * Sets or replaces the login method. A `null` hash clears that method; the two are
   * independent, so a parent can move a child from a PIN to pictures without a second call.
   */
  upsert(
    input: Readonly<{
      studentId: string;
      pinHash?: string | null;
      pictureHash?: string | null;
      familyDevice?: boolean;
      at: Date;
    }>,
  ): Promise<ChildCredential>;
  /** One more wrong answer, and the lock that follows if it was the last one allowed. */
  recordFailure(studentId: string, at: Date, lockedUntil: Date | null): Promise<void>;
  clearFailures(studentId: string, at: Date): Promise<void>;
}>;

const SQL = {
  find: `SELECT ${COLUMNS} FROM child_credential WHERE student_id = $1`,

  // COALESCE on the hashes would make "clear this method" unexpressible, so the caller states
  // which columns it is writing: $5/$6/$7 are the "did you mean this one" flags.
  upsert: `INSERT INTO child_credential
             (student_id, pin_hash, picture_hash, family_device, updated_at)
           VALUES ($1, $2, $3, COALESCE($4, false), $8)
           ON CONFLICT (student_id) DO UPDATE SET
             pin_hash = CASE WHEN $5 THEN EXCLUDED.pin_hash ELSE child_credential.pin_hash END,
             picture_hash = CASE WHEN $6 THEN EXCLUDED.picture_hash
                                 ELSE child_credential.picture_hash END,
             family_device = CASE WHEN $7 THEN EXCLUDED.family_device
                                  ELSE child_credential.family_device END,
             -- Changing how a child signs in clears whatever lock the old method collected.
             failed_attempts = 0,
             locked_until = NULL,
             updated_at = EXCLUDED.updated_at
           RETURNING ${COLUMNS}`,

  recordFailure: `UPDATE child_credential
                  SET failed_attempts = failed_attempts + 1, locked_until = $3, updated_at = $2
                  WHERE student_id = $1`,

  clearFailures: `UPDATE child_credential
                  SET failed_attempts = 0, locked_until = NULL, updated_at = $2
                  WHERE student_id = $1`,
} as const;

export function createChildCredentialRepository(db: Queryable): ChildCredentialRepository {
  return {
    withDb: (next) => createChildCredentialRepository(next),

    async find(studentId) {
      const { rows } = await runQuery<ChildCredentialRow>({
        db,
        operation: 'childCredential.find',
        sql: SQL.find,
        params: [studentId],
      });
      const row = rows[0];
      return row ? toChildCredential(row) : null;
    },

    async upsert(input) {
      const { rows } = await runQuery<ChildCredentialRow>({
        db,
        operation: 'childCredential.upsert',
        sql: SQL.upsert,
        params: [
          input.studentId,
          input.pinHash ?? null,
          input.pictureHash ?? null,
          input.familyDevice ?? null,
          input.pinHash !== undefined,
          input.pictureHash !== undefined,
          input.familyDevice !== undefined,
          input.at,
        ],
      });
      const row = rows[0];
      if (!row) throw new Error('childCredential.upsert returned no row');
      return toChildCredential(row);
    },

    async recordFailure(studentId, at, lockedUntil) {
      await runQuery({
        db,
        operation: 'childCredential.recordFailure',
        sql: SQL.recordFailure,
        params: [studentId, at, lockedUntil],
      });
    },

    async clearFailures(studentId, at) {
      await runQuery({
        db,
        operation: 'childCredential.clearFailures',
        sql: SQL.clearFailures,
        params: [studentId, at],
      });
    },
  };
}
