import type { ChildCredential, ChildSessionRecord } from '@/types/auth';

import { unmappableRow } from './row';

/**
 * Rows for the two tables migration 009 adds, mapped field by field like every other mapper.
 *
 * Neither domain type carries a secret. `token_hash`, `pin_hash` and `picture_hash` are read
 * by the services that compare them and stop at this boundary in the case of the session —
 * a `ChildSessionRecord` that carried its own token would be one `res.json` away from
 * handing it back out.
 */
export type ChildSessionRow = {
  id: string;
  student_id: string;
  parent_id: string;
  issued_at: Date;
  last_seen_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
  device_label: string | null;
};

export type ChildCredentialRow = {
  student_id: string;
  pin_hash: string | null;
  picture_hash: string | null;
  family_device: boolean;
  failed_attempts: number;
  locked_until: Date | null;
};

export function toChildSession(row: ChildSessionRow): ChildSessionRecord {
  for (const [column, value] of [
    ['issued_at', row.issued_at],
    ['last_seen_at', row.last_seen_at],
    ['expires_at', row.expires_at],
  ] as const) {
    if (!(value instanceof Date)) throw unmappableRow('child_session', column, row.id);
  }

  return {
    id: row.id,
    studentId: row.student_id,
    parentId: row.parent_id,
    issuedAt: row.issued_at,
    lastSeenAt: row.last_seen_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    deviceLabel: row.device_label,
  };
}

export function toChildCredential(row: ChildCredentialRow): ChildCredential {
  if (!Number.isInteger(row.failed_attempts)) {
    throw unmappableRow('child_credential', 'failed_attempts', row.student_id);
  }

  return {
    studentId: row.student_id,
    pinHash: row.pin_hash,
    pictureHash: row.picture_hash,
    familyDevice: row.family_device,
    failedAttempts: row.failed_attempts,
    lockedUntil: row.locked_until,
  };
}
