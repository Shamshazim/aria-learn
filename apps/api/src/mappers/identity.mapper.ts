import { z } from 'zod';

import { ADULT_ROLES, CONSENT_METHODS, IDENTITY_PROVIDERS } from '@/types/identity';
import type { AdultIdentity, AdultSession, ConsentRecord } from '@/types/identity';

import { unmappableRow } from './row';

/**
 * Rows to domain objects, field by field and never by spread.
 *
 * The enums are parsed rather than asserted even though CHECK constraints already guarantee
 * them, for the reason `student.mapper.ts` gives: the constraint protects the rows written
 * today, the parse protects the day the vocabulary changes and an old row no longer fits it.
 */
const roleSchema = z.enum(ADULT_ROLES);
const providerSchema = z.enum(IDENTITY_PROVIDERS);
const methodSchema = z.enum(CONSENT_METHODS);

export type AdultIdentityRow = {
  id: string;
  role: string;
  provider: string;
  provider_subject: string;
  parent_id: string | null;
  attested_adult_at: Date;
  created_at: Date;
};

export function toAdultIdentity(row: AdultIdentityRow): AdultIdentity {
  const role = roleSchema.safeParse(row.role);
  if (!role.success) throw unmappableRow('adult_identity', 'role', row.id);

  const provider = providerSchema.safeParse(row.provider);
  if (!provider.success) throw unmappableRow('adult_identity', 'provider', row.id);

  // The constraint pairs these two, so a row that breaks the pairing is a corrupt row rather
  // than a shape the domain type should be widened to admit.
  if ((role.data === 'parent') !== (row.parent_id !== null)) {
    throw unmappableRow('adult_identity', 'parent_id', row.id);
  }

  return {
    id: row.id,
    role: role.data,
    provider: provider.data,
    providerSubject: row.provider_subject,
    parentId: row.parent_id,
    attestedAdultAt: requireDate(
      row.attested_adult_at,
      'adult_identity',
      'attested_adult_at',
      row.id,
    ),
    createdAt: requireDate(row.created_at, 'adult_identity', 'created_at', row.id),
  };
}

export type ConsentRow = {
  id: string;
  adult_id: string;
  method: string;
  source_reference: string | null;
  granted_at: Date;
  revoked_at: Date | null;
};

export function toConsentRecord(row: ConsentRow): ConsentRecord {
  const method = methodSchema.safeParse(row.method);
  if (!method.success) throw unmappableRow('consent_record', 'method', row.id);

  return {
    id: row.id,
    adultId: row.adult_id,
    method: method.data,
    sourceReference: row.source_reference,
    grantedAt: requireDate(row.granted_at, 'consent_record', 'granted_at', row.id),
    revokedAt: optionalDate(row.revoked_at, 'consent_record', 'revoked_at', row.id),
  };
}

export type AdultSessionRow = {
  id: string;
  adult_id: string;
  provider_session_id: string;
  created_at: Date;
  last_seen_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
};

export function toAdultSession(row: AdultSessionRow): AdultSession {
  return {
    id: row.id,
    adultId: row.adult_id,
    providerSessionId: row.provider_session_id,
    createdAt: requireDate(row.created_at, 'adult_session', 'created_at', row.id),
    lastSeenAt: requireDate(row.last_seen_at, 'adult_session', 'last_seen_at', row.id),
    absoluteExpiresAt: requireDate(
      row.absolute_expires_at,
      'adult_session',
      'absolute_expires_at',
      row.id,
    ),
    revokedAt: optionalDate(row.revoked_at, 'adult_session', 'revoked_at', row.id),
  };
}

/**
 * `pg` returns TIMESTAMPTZ as a `Date`, but only while the type parser is the default one.
 * Checking it here means a future parser change fails loudly at the mapper rather than
 * quietly producing a string that every consumer then treats as a date.
 */
export function requireDate(value: unknown, table: string, column: string, id: string): Date {
  if (!(value instanceof Date)) throw unmappableRow(table, column, id);
  return value;
}

export function optionalDate(
  value: unknown,
  table: string,
  column: string,
  id: string,
): Date | null {
  if (value === null || value === undefined) return null;
  return requireDate(value, table, column, id);
}
