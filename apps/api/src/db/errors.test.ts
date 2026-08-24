import { describe, expect, it } from 'vitest';

import { AppError, ERROR_CODES } from '@/errors';

import { mapDatabaseError, SQL_STATES } from './errors';

/** A driver error as `pg` actually throws it, `detail` and all. */
function pgError(code: string, extra: Record<string, string> = {}): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code,
    ...extra,
  });
}

describe('mapDatabaseError', () => {
  it('maps a unique violation to 409', () => {
    const mapped = mapDatabaseError(pgError(SQL_STATES.UNIQUE_VIOLATION), 'parent.insert');

    expect(mapped.status).toBe(409);
    expect(mapped.code).toBe(ERROR_CODES.CONFLICT);
    expect(mapped.safeMessage).toBe('That already exists.');
  });

  it.each([
    ['foreign key', SQL_STATES.FOREIGN_KEY_VIOLATION],
    ['check', SQL_STATES.CHECK_VIOLATION],
    ['not null', SQL_STATES.NOT_NULL_VIOLATION],
  ])('maps a %s violation to 400 — the request broke an invariant', (_label, code) => {
    expect(mapDatabaseError(pgError(code), 'student.insert').status).toBe(400);
  });

  it.each([
    ['statement timeout', SQL_STATES.QUERY_CANCELED],
    ['admin shutdown', SQL_STATES.ADMIN_SHUTDOWN],
    ['connection failure', '08006'],
  ])('maps %s to 503, so a caller can retry', (_label, code) => {
    expect(mapDatabaseError(pgError(code), 'student.findById').status).toBe(503);
  });

  it('maps an unrecognised sqlstate to a generic 500', () => {
    const mapped = mapDatabaseError(pgError('42601'), 'student.findById');

    expect(mapped.status).toBe(500);
    expect(mapped.code).toBe(ERROR_CODES.INTERNAL);
  });

  it('passes an AppError through untouched rather than wrapping it twice', () => {
    const original = new AppError(ERROR_CODES.NOT_FOUND, 404, 'Not found.');

    expect(mapDatabaseError(original, 'student.findById')).toBe(original);
  });

  it('handles a non-error rejection', () => {
    expect(mapDatabaseError('a bare string', 'student.findById').status).toBe(500);
  });

  /**
   * The reason this module exists. `detail` on a unique violation quotes the offending value
   * back — for `parent_email_key` that is a parent's email address, which §5 forbids us to
   * log. Neither the message nor the cause may carry it.
   */
  it('never carries the driver detail into the message or the cause', () => {
    const leaky = pgError(SQL_STATES.UNIQUE_VIOLATION, {
      detail: 'Key (email)=(parent@example.com) already exists.',
      constraint: 'parent_email_key',
      table: 'parent',
    });

    const mapped = mapDatabaseError(leaky, 'parent.insert');
    const everythingWeWouldLog = JSON.stringify({
      message: mapped.message,
      safeMessage: mapped.safeMessage,
      cause: mapped.cause instanceof Error ? mapped.cause.message : String(mapped.cause),
    });

    expect(everythingWeWouldLog).not.toContain('parent@example.com');
    // The constraint name survives, because that is what makes it diagnosable.
    expect(mapped.message).toContain('parent_email_key');
    expect(mapped.message).toContain('parent.insert');
  });
});
