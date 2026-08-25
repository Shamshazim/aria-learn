import { z } from 'zod';

import { DELETION_STAGES, DELETION_SUBJECT_KINDS } from '@/types/deletion';
import type { DeletionRequest } from '@/types/deletion';
import type { ChildProfileSummary, ChildSession, DeviceGrant } from '@/types/device-access';

import { optionalDate, requireDate } from './identity.mapper';
import { unmappableRow } from './row';

/**
 * Rows to domain objects for the child-side tables: device grants, child sessions, the
 * profile summary the picker shows, and the deletion ledger.
 *
 * Nothing in here maps a credential. `secret_hash` and `token_hash` are selected only by the
 * repositories that look a row up by them and never travel further; a domain object a service
 * holds cannot leak a secret it does not carry.
 */
const stageSchema = z.enum(DELETION_STAGES);
const subjectKindSchema = z.enum(DELETION_SUBJECT_KINDS);

export type DeviceGrantRow = {
  id: string;
  parent_id: string;
  label: string;
  created_at: Date;
  last_seen_at: Date | null;
  revoked_at: Date | null;
  /** Aggregated by the query, so listing grants with their children is one round trip. */
  student_ids: string[] | null;
};

export function toDeviceGrant(row: DeviceGrantRow): DeviceGrant {
  return {
    id: row.id,
    parentId: row.parent_id,
    label: row.label,
    createdAt: requireDate(row.created_at, 'device_grant', 'created_at', row.id),
    lastSeenAt: optionalDate(row.last_seen_at, 'device_grant', 'last_seen_at', row.id),
    revokedAt: optionalDate(row.revoked_at, 'device_grant', 'revoked_at', row.id),
    studentIds: row.student_ids ?? [],
  };
}

export type ChildSessionRow = {
  id: string;
  grant_id: string;
  student_id: string;
  created_at: Date;
  last_seen_at: Date;
  absolute_expires_at: Date;
  revoked_at: Date | null;
};

export function toChildSession(row: ChildSessionRow): ChildSession {
  return {
    id: row.id,
    grantId: row.grant_id,
    studentId: row.student_id,
    createdAt: requireDate(row.created_at, 'child_session', 'created_at', row.id),
    lastSeenAt: requireDate(row.last_seen_at, 'child_session', 'last_seen_at', row.id),
    absoluteExpiresAt: requireDate(
      row.absolute_expires_at,
      'child_session',
      'absolute_expires_at',
      row.id,
    ),
    revokedAt: optionalDate(row.revoked_at, 'child_session', 'revoked_at', row.id),
  };
}

export type ChildProfileRow = {
  id: string;
  display_name: string;
  avatar_key: string | null;
};

/**
 * What an unauthenticated device may see: a picture and a nickname, for the children that
 * device was granted. Grade, band and every learning fact are deliberately absent — the
 * picker runs before anyone has proven who they are.
 */
export function toChildProfileSummary(row: ChildProfileRow): ChildProfileSummary {
  return {
    studentId: row.id,
    nickname: row.display_name,
    avatarKey: row.avatar_key,
  };
}

export type DeletionRequestRow = {
  id: string;
  subject_kind: string;
  subject_id: string;
  provider: string | null;
  provider_subject: string | null;
  stage: string;
  attempts: number;
  last_error: string | null;
  requested_at: Date;
  completed_at: Date | null;
};

export function toDeletionRequest(row: DeletionRequestRow): DeletionRequest {
  const kind = subjectKindSchema.safeParse(row.subject_kind);
  if (!kind.success) throw unmappableRow('deletion_request', 'subject_kind', row.id);

  const stage = stageSchema.safeParse(row.stage);
  if (!stage.success) throw unmappableRow('deletion_request', 'stage', row.id);

  return {
    id: row.id,
    subjectKind: kind.data,
    subjectId: row.subject_id,
    provider: row.provider,
    providerSubject: row.provider_subject,
    stage: stage.data,
    attempts: row.attempts,
    lastError: row.last_error,
    requestedAt: requireDate(row.requested_at, 'deletion_request', 'requested_at', row.id),
    completedAt: optionalDate(row.completed_at, 'deletion_request', 'completed_at', row.id),
  };
}
