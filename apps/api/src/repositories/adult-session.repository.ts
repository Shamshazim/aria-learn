import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toAdultSession } from '@/mappers/identity.mapper';
import type { AdultSessionRow } from '@/mappers/identity.mapper';
import type { AdultSession } from '@/types/identity';

/**
 * Aria's record of a provider session.
 *
 * Aria issues no adult token — P0-28 forbids building a token issuer — so this table does not
 * store a credential. It stores the *decision* to honour one: the provider's `session_id`
 * claim, when Aria last saw it, when it must stop being honoured, and whether a parent has
 * revoked it. That is what makes revocation immediate against a JWT that has not expired.
 */
export type AdultSessionRepository = {
  withDb(db: Queryable): AdultSessionRepository;
  /**
   * Idempotent by provider session id. An adult who reloads the sign-in callback must not
   * accumulate one Aria session per reload.
   */
  /** `at` is passed rather than left to the column default — see `child-session.repository.ts`. */
  upsert(input: {
    adultId: string;
    providerSessionId: string;
    at: Date;
    absoluteExpiresAt: Date;
  }): Promise<AdultSession>;
  findByProviderSessionId(providerSessionId: string): Promise<AdultSession | null>;
  /** Records activity, which is what the 7-day idle window is measured from. */
  touch(id: string, at: Date): Promise<void>;
  listActive(adultId: string, at: Date): Promise<readonly AdultSession[]>;
  revoke(id: string, at: Date): Promise<boolean>;
  /** Every session this adult holds, revoked in one statement. The first step of deletion. */
  revokeAllForAdult(adultId: string, at: Date): Promise<number>;
};

const COLUMNS = `id, adult_id, provider_session_id, created_at, last_seen_at, absolute_expires_at, revoked_at`;

/** Every statement this repository can issue, in one block — see `student.repository.ts`. */
const SQL = {
  // A re-sign-in on the same provider session revives it rather than leaving a revoked row
  // behind: the provider has just re-authenticated the adult, which is the stronger signal.
  upsert: `INSERT INTO adult_session
             (id, adult_id, provider_session_id, created_at, last_seen_at, absolute_expires_at)
           VALUES ($1, $2, $3, $4, $4, $5)
           ON CONFLICT (provider_session_id) DO UPDATE
             SET last_seen_at = EXCLUDED.last_seen_at, revoked_at = NULL
           RETURNING ${COLUMNS}`,

  findByProviderSessionId: `SELECT ${COLUMNS} FROM adult_session WHERE provider_session_id = $1`,

  touch: `UPDATE adult_session SET last_seen_at = $2 WHERE id = $1 AND revoked_at IS NULL`,

  listActive: `SELECT ${COLUMNS} FROM adult_session
               WHERE adult_id = $1 AND revoked_at IS NULL AND absolute_expires_at > $2
               ORDER BY last_seen_at DESC, id`,

  revoke: `UPDATE adult_session SET revoked_at = $2 WHERE id = $1 AND revoked_at IS NULL`,

  revokeAllForAdult: `UPDATE adult_session SET revoked_at = $2
                      WHERE adult_id = $1 AND revoked_at IS NULL`,
} as const;

export type AdultSessionRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createAdultSessionRepository(
  deps: AdultSessionRepositoryDeps,
): AdultSessionRepository {
  const { db } = deps;

  return {
    withDb: (next) => createAdultSessionRepository({ ...deps, db: next }),
    upsert: (input) => upsert(deps, input),
    findByProviderSessionId: (providerSessionId) => findByProviderSessionId(db, providerSessionId),
    touch: (id, at) => execute(db, 'adultSession.touch', SQL.touch, [id, at]).then(() => undefined),
    listActive: (adultId, at) => listActive(db, adultId, at),
    revoke: async (id, at) => (await execute(db, 'adultSession.revoke', SQL.revoke, [id, at])) > 0,
    revokeAllForAdult: (adultId, at) =>
      execute(db, 'adultSession.revokeAllForAdult', SQL.revokeAllForAdult, [adultId, at]),
  };
}

async function upsert(
  deps: AdultSessionRepositoryDeps,
  input: { adultId: string; providerSessionId: string; at: Date; absoluteExpiresAt: Date },
): Promise<AdultSession> {
  const { rows } = await runQuery<AdultSessionRow>({
    db: deps.db,
    operation: 'adultSession.upsert',
    sql: SQL.upsert,
    params: [
      deps.ids.next(),
      input.adultId,
      input.providerSessionId,
      input.at,
      input.absoluteExpiresAt,
    ],
  });

  const row = rows[0];
  if (!row) throw new NotFoundError('adultSession.upsert returned no row');
  return toAdultSession(row);
}

async function findByProviderSessionId(
  db: Queryable,
  providerSessionId: string,
): Promise<AdultSession | null> {
  const { rows } = await runQuery<AdultSessionRow>({
    db,
    operation: 'adultSession.findByProviderSessionId',
    sql: SQL.findByProviderSessionId,
    params: [providerSessionId],
  });
  const row = rows[0];
  return row ? toAdultSession(row) : null;
}

async function listActive(
  db: Queryable,
  adultId: string,
  at: Date,
): Promise<readonly AdultSession[]> {
  const { rows } = await runQuery<AdultSessionRow>({
    db,
    operation: 'adultSession.listActive',
    sql: SQL.listActive,
    params: [adultId, at],
  });
  return rows.map(toAdultSession);
}

/** Statements whose only interesting result is how many rows they changed. */
async function execute(
  db: Queryable,
  operation: string,
  sql: string,
  params: readonly unknown[],
): Promise<number> {
  const { rowCount } = await runQuery({ db, operation, sql, params });
  return rowCount ?? 0;
}
