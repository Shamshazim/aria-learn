import { z } from 'zod';

import {
  CONSENT_METHODS,
  DELETION_STAGES,
  type ConsentRecord,
  type DeletionRequest,
  type DeviceGrant,
  type ParentSessionRecord,
} from '@/types/parent-access';

import { unmappableRow } from './row';

/**
 * Rows for the four tables migration 010 adds, mapped field by field.
 *
 * No secret crosses this boundary. `device_grant.secret_hash` has no field on `DeviceGrant`,
 * for the reason `ChildSessionRecord` has no token: a domain type that carried one would be a
 * single `res.json` away from handing it back out.
 *
 * The two constrained columns are parsed rather than cast. The database CHECK already forbids
 * anything else, so this only fires if the two ever disagree — which is exactly when a silent
 * cast would be worst.
 */
const methodSchema = z.enum(CONSENT_METHODS);
const stageSchema = z.enum(DELETION_STAGES);

export type DeviceGrantRow = {
  id: string;
  parent_id: string;
  label: string;
  created_at: Date;
  last_seen_at: Date | null;
  revoked_at: Date | null;
};

export type ParentSessionRow = {
  id: string;
  parent_id: string;
  provider_session_id: string;
  issued_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};

export type ConsentRecordRow = {
  id: string;
  parent_id: string;
  method: string;
  source_reference: string | null;
  disclosure_version: string;
  granted_at: Date;
  withdrawn_at: Date | null;
};

export type DeletionRequestRow = {
  id: string;
  subject_kind: string;
  subject_id: string;
  parent_id: string;
  provider_subject: string | null;
  stage: string;
  requested_at: Date;
  updated_at: Date;
  attempts: number;
  last_error: string | null;
};

export function toDeviceGrant(row: DeviceGrantRow): DeviceGrant {
  requireDate('device_grant', 'created_at', row.created_at, row.id);

  return {
    id: row.id,
    parentId: row.parent_id,
    label: row.label,
    createdAt: row.created_at,
    lastSeenAt: row.last_seen_at,
    revokedAt: row.revoked_at,
  };
}

export function toParentSession(row: ParentSessionRow): ParentSessionRecord {
  for (const [column, value] of [
    ['issued_at', row.issued_at],
    ['last_seen_at', row.last_seen_at],
    ['expires_at', row.expires_at],
  ] as const) {
    requireDate('parent_session', column, value, row.id);
  }

  return {
    id: row.id,
    parentId: row.parent_id,
    providerSessionId: row.provider_session_id,
    issuedAt: row.issued_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
  };
}

export function toConsentRecord(row: ConsentRecordRow): ConsentRecord {
  const method = methodSchema.safeParse(row.method);
  if (!method.success) throw unmappableRow('consent_record', 'method', row.id);
  requireDate('consent_record', 'granted_at', row.granted_at, row.id);

  return {
    id: row.id,
    parentId: row.parent_id,
    method: method.data,
    sourceReference: row.source_reference,
    disclosureVersion: row.disclosure_version,
    grantedAt: row.granted_at,
    withdrawnAt: row.withdrawn_at,
  };
}

export function toDeletionRequest(row: DeletionRequestRow): DeletionRequest {
  const stage = stageSchema.safeParse(row.stage);
  if (!stage.success) throw unmappableRow('deletion_request', 'stage', row.id);
  if (row.subject_kind !== 'child' && row.subject_kind !== 'account') {
    throw unmappableRow('deletion_request', 'subject_kind', row.id);
  }

  return {
    id: row.id,
    subjectKind: row.subject_kind,
    subjectId: row.subject_id,
    parentId: row.parent_id,
    providerSubject: row.provider_subject,
    stage: stage.data,
    requestedAt: row.requested_at,
    updatedAt: row.updated_at,
    attempts: row.attempts,
    lastError: row.last_error,
  };
}

function requireDate(table: string, column: string, value: unknown, id: string): void {
  if (!(value instanceof Date)) throw unmappableRow(table, column, id);
}
