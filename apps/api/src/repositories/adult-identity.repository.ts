import { runQuery } from '@/db/run-query';
import type { Queryable } from '@/db/types';
import { NotFoundError } from '@/errors';
import type { IdGenerator } from '@/lib/ids';
import { toAdultIdentity, toConsentRecord } from '@/mappers/identity.mapper';
import type { AdultIdentityRow, ConsentRow } from '@/mappers/identity.mapper';
import type {
  AdultIdentity,
  ConsentMethod,
  ConsentRecord,
  IdentityProviderName,
  NewAdultIdentity,
} from '@/types/identity';

/**
 * The adult identity and the consent that lets it own a child, following the repository shape
 * `student.repository.ts` established.
 *
 * The lookup that matters is `findBySubject`: it is what every authenticated request runs, and
 * it is why a provider token for an adult Aria has deleted is rejected — the token still
 * verifies, and there is simply no row.
 */
export type AdultIdentityRepository = {
  withDb(db: Queryable): AdultIdentityRepository;
  insert(input: NewAdultIdentity): Promise<AdultIdentity>;
  findBySubject(provider: IdentityProviderName, subject: string): Promise<AdultIdentity | null>;
  findById(id: string): Promise<AdultIdentity | null>;
  requireById(id: string): Promise<AdultIdentity>;
  findByParentId(parentId: string): Promise<AdultIdentity | null>;
  recordConsent(input: {
    adultId: string;
    method: ConsentMethod;
    sourceReference: string | null;
  }): Promise<ConsentRecord>;
  /** The question the child-profile service asks before it will create or open a profile. */
  hasActiveConsent(adultId: string): Promise<boolean>;
  listConsent(adultId: string): Promise<readonly ConsentRecord[]>;
};

const COLUMNS = `id, role, provider, provider_subject, parent_id, attested_adult_at, created_at`;
const CONSENT_COLUMNS = `id, adult_id, method, source_reference, granted_at, revoked_at`;

/** Every statement this repository can issue, in one block — see `student.repository.ts`. */
const SQL = {
  insert: `INSERT INTO adult_identity (id, role, provider, provider_subject, parent_id, attested_adult_at)
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING ${COLUMNS}`,

  findBySubject: `SELECT ${COLUMNS} FROM adult_identity WHERE provider = $1 AND provider_subject = $2`,

  findById: `SELECT ${COLUMNS} FROM adult_identity WHERE id = $1`,

  findByParentId: `SELECT ${COLUMNS} FROM adult_identity WHERE parent_id = $1`,

  recordConsent: `INSERT INTO consent_record (id, adult_id, method, source_reference)
                  VALUES ($1, $2, $3, $4)
                  RETURNING ${CONSENT_COLUMNS}`,

  // `EXISTS` rather than a count: the answer is a boolean and the partial index makes it an
  // index-only probe, so the check every child-profile call runs costs almost nothing.
  hasActiveConsent: `SELECT EXISTS (
                       SELECT 1 FROM consent_record WHERE adult_id = $1 AND revoked_at IS NULL
                     ) AS granted`,

  listConsent: `SELECT ${CONSENT_COLUMNS} FROM consent_record
                WHERE adult_id = $1
                ORDER BY granted_at DESC, id`,
} as const;

export type AdultIdentityRepositoryDeps = {
  db: Queryable;
  ids: IdGenerator;
};

export function createAdultIdentityRepository(
  deps: AdultIdentityRepositoryDeps,
): AdultIdentityRepository {
  const { db, ids } = deps;

  const repository: AdultIdentityRepository = {
    withDb: (next) => createAdultIdentityRepository({ ...deps, db: next }),
    insert: (input) => insert(deps, input),
    findBySubject: (provider, subject) =>
      one(db, 'adultIdentity.findBySubject', SQL.findBySubject, [provider, subject]),
    findById: (id) => one(db, 'adultIdentity.findById', SQL.findById, [id]),
    findByParentId: (parentId) =>
      one(db, 'adultIdentity.findByParentId', SQL.findByParentId, [parentId]),
    requireById: async (id) => {
      const identity = await repository.findById(id);
      if (!identity) throw new NotFoundError(`adult identity ${id} not found`);
      return identity;
    },
    recordConsent: (input) => recordConsent(db, ids, input),
    hasActiveConsent: (adultId) => hasActiveConsent(db, adultId),
    listConsent: (adultId) => listConsent(db, adultId),
  };

  return repository;
}

async function insert(
  deps: AdultIdentityRepositoryDeps,
  input: NewAdultIdentity,
): Promise<AdultIdentity> {
  const { rows } = await runQuery<AdultIdentityRow>({
    db: deps.db,
    operation: 'adultIdentity.insert',
    sql: SQL.insert,
    params: [
      deps.ids.next(),
      input.role,
      input.provider,
      input.providerSubject,
      input.parentId,
      input.attestedAdultAt,
    ],
  });

  const row = rows[0];
  if (!row) throw new NotFoundError('adultIdentity.insert returned no row');
  return toAdultIdentity(row);
}

async function one(
  db: Queryable,
  operation: string,
  sql: string,
  params: readonly unknown[],
): Promise<AdultIdentity | null> {
  const { rows } = await runQuery<AdultIdentityRow>({ db, operation, sql, params });
  const row = rows[0];
  return row ? toAdultIdentity(row) : null;
}

async function recordConsent(
  db: Queryable,
  ids: IdGenerator,
  input: { adultId: string; method: ConsentMethod; sourceReference: string | null },
): Promise<ConsentRecord> {
  const { rows } = await runQuery<ConsentRow>({
    db,
    operation: 'adultIdentity.recordConsent',
    sql: SQL.recordConsent,
    params: [ids.next(), input.adultId, input.method, input.sourceReference],
  });

  const row = rows[0];
  if (!row) throw new NotFoundError('adultIdentity.recordConsent returned no row');
  return toConsentRecord(row);
}

async function hasActiveConsent(db: Queryable, adultId: string): Promise<boolean> {
  const { rows } = await runQuery<{ granted: boolean }>({
    db,
    operation: 'adultIdentity.hasActiveConsent',
    sql: SQL.hasActiveConsent,
    params: [adultId],
  });
  return rows[0]?.granted === true;
}

async function listConsent(db: Queryable, adultId: string): Promise<readonly ConsentRecord[]> {
  const { rows } = await runQuery<ConsentRow>({
    db,
    operation: 'adultIdentity.listConsent',
    sql: SQL.listConsent,
    params: [adultId],
  });
  return rows.map(toConsentRecord);
}
