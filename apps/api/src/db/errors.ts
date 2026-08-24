import {
  AppError,
  ConflictError,
  ServiceUnavailableError,
  ValidationError,
  ERROR_CODES,
} from '@/errors';

/**
 * Postgres failures, translated into the one error shape the API speaks.
 *
 * The translation is deliberately lossy in one direction. A driver error carries `detail`,
 * which for a unique violation reads `Key (email)=(someone@example.com) already exists` — a
 * parent's email address, which CODE-STANDARDS §5 forbids us to log. So the SQLSTATE and the
 * constraint name survive and the payload does not, in the log as well as in the response.
 */

/** SQLSTATE classes we act on. Everything else is an unexpected failure and becomes a 500. */
const SQL_STATE = {
  NOT_NULL_VIOLATION: '23502',
  FOREIGN_KEY_VIOLATION: '23503',
  UNIQUE_VIOLATION: '23505',
  CHECK_VIOLATION: '23514',
  /** Postgres killed the statement at `statement_timeout`. */
  QUERY_CANCELED: '57014',
  ADMIN_SHUTDOWN: '57P01',
  CANNOT_CONNECT_NOW: '57P03',
} as const;

/** Class 08 — the connection itself failed. Retryable, and never the caller's fault. */
const CONNECTION_CLASS = '08';

type PgErrorShape = {
  code?: string;
  constraint?: string;
  table?: string;
  routine?: string;
};

export function isDatabaseError(error: unknown): error is Error & PgErrorShape {
  return error instanceof Error && 'code' in error && typeof error.code === 'string';
}

/**
 * A cause safe to attach to an `AppError`.
 *
 * The stack is what makes a 500 diagnosable, so it is kept; the driver's `detail` and
 * `where` fields are not, because they quote the offending row back at us.
 */
function safeCause(error: Error & PgErrorShape): Error {
  const cause = new Error(
    `postgres ${error.code ?? 'unknown'}${error.constraint ? ` on ${error.constraint}` : ''}`,
  );
  if (error.stack !== undefined) cause.stack = error.stack;
  return cause;
}

function describe(error: Error & PgErrorShape, operation: string): string {
  const parts = [operation, `sqlstate=${error.code ?? 'unknown'}`];
  if (error.table) parts.push(`table=${error.table}`);
  if (error.constraint) parts.push(`constraint=${error.constraint}`);
  return parts.join(' ');
}

/**
 * Every repository funnels its failures through here, so the mapping from SQLSTATE to HTTP
 * status is decided once rather than re-guessed per query.
 */
export function mapDatabaseError(error: unknown, operation: string): AppError {
  if (error instanceof AppError) return error;

  if (!isDatabaseError(error)) {
    return new AppError(ERROR_CODES.INTERNAL, 500, 'Something went wrong.', {
      cause: error,
      logMessage: `${operation} failed with a non-database error`,
    });
  }

  const context = describe(error, operation);
  const cause = safeCause(error);

  switch (error.code) {
    case SQL_STATE.UNIQUE_VIOLATION:
      return new ConflictError(context, cause);
    case SQL_STATE.FOREIGN_KEY_VIOLATION:
    case SQL_STATE.CHECK_VIOLATION:
    case SQL_STATE.NOT_NULL_VIOLATION:
      // The row broke an invariant the schema holds, which means the request was wrong.
      return new ValidationError(context, cause);
    case SQL_STATE.QUERY_CANCELED:
    case SQL_STATE.ADMIN_SHUTDOWN:
    case SQL_STATE.CANNOT_CONNECT_NOW:
      return new ServiceUnavailableError(context, cause);
    default:
      break;
  }

  if (error.code?.startsWith(CONNECTION_CLASS)) {
    return new ServiceUnavailableError(context, cause);
  }

  return new AppError(ERROR_CODES.INTERNAL, 500, 'Something went wrong.', {
    cause,
    logMessage: context,
  });
}

export const SQL_STATES = SQL_STATE;
