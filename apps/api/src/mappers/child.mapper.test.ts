import { describe, expect, it } from 'vitest';

import { toChildCredential, toChildSession } from './child.mapper';

import type { ChildCredentialRow, ChildSessionRow } from './child.mapper';

const SESSION_ROW: ChildSessionRow = {
  id: '00000000-0000-4000-8000-0000000000dd',
  student_id: '00000000-0000-4000-8000-000000000001',
  parent_id: '00000000-0000-4000-8000-0000000000a1',
  issued_at: new Date('2026-08-25T10:00:00.000Z'),
  last_seen_at: new Date('2026-08-25T10:05:00.000Z'),
  expires_at: new Date('2026-08-25T22:00:00.000Z'),
  revoked_at: null,
  device_label: 'kitchen tablet',
};

const CREDENTIAL_ROW: ChildCredentialRow = {
  student_id: '00000000-0000-4000-8000-000000000001',
  pin_hash: '$argon2id$v=19$whatever',
  picture_hash: null,
  family_device: false,
  failed_attempts: 2,
  locked_until: null,
};

describe('toChildSession', () => {
  it('maps every column to its domain field', () => {
    expect(toChildSession(SESSION_ROW)).toEqual({
      id: SESSION_ROW.id,
      studentId: SESSION_ROW.student_id,
      parentId: SESSION_ROW.parent_id,
      issuedAt: SESSION_ROW.issued_at,
      lastSeenAt: SESSION_ROW.last_seen_at,
      expiresAt: SESSION_ROW.expires_at,
      revokedAt: null,
      deviceLabel: 'kitchen tablet',
    });
  });

  /** The token hash is not a domain field; a record that carried it could be serialised. */
  it('never carries a token hash out of the row', () => {
    const withHash = { ...SESSION_ROW, token_hash: 'deadbeef' };

    expect(JSON.stringify(toChildSession(withHash))).not.toContain('deadbeef');
  });

  it.each(['issued_at', 'last_seen_at', 'expires_at'] as const)(
    'refuses a row whose %s is not a date',
    (column) => {
      expect(() => toChildSession({ ...SESSION_ROW, [column]: '2026-08-25' })).toThrow(
        /outside its domain type/u,
      );
    },
  );
});

describe('toChildCredential', () => {
  it('maps every column to its domain field', () => {
    expect(toChildCredential(CREDENTIAL_ROW)).toEqual({
      studentId: CREDENTIAL_ROW.student_id,
      pinHash: CREDENTIAL_ROW.pin_hash,
      pictureHash: null,
      familyDevice: false,
      failedAttempts: 2,
      lockedUntil: null,
    });
  });

  it('refuses a counter that is not a whole number', () => {
    expect(() => toChildCredential({ ...CREDENTIAL_ROW, failed_attempts: 1.5 })).toThrow(
      /outside its domain type/u,
    );
  });
});
