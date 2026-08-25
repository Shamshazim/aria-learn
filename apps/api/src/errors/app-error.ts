import { ERROR_CODES, type ErrorCode } from './codes';

/**
 * The one error shape the API speaks.
 *
 * `safeMessage` is the only text that ever reaches a client, which is what keeps a SQL
 * string, a vendor name or a stack trace from leaking (CODE-STANDARDS §5). `cause` carries
 * the underlying failure for the log and never crosses the wire.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly safeMessage: string;

  constructor(
    code: ErrorCode,
    status: number,
    safeMessage: string,
    options?: { cause?: unknown; logMessage?: string },
  ) {
    super(options?.logMessage ?? safeMessage, { cause: options?.cause });
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.safeMessage = safeMessage;
    Error.captureStackTrace(this, new.target);
  }
}

/** A request that did not satisfy its schema. The detail belongs in the log, not the body. */
export class ValidationError extends AppError {
  constructor(logMessage: string, cause?: unknown) {
    super(ERROR_CODES.VALIDATION_FAILED, 400, 'The request was not valid.', {
      cause,
      logMessage,
    });
  }
}

export class NotFoundError extends AppError {
  constructor(logMessage: string) {
    super(ERROR_CODES.NOT_FOUND, 404, 'Not found.', { logMessage });
  }
}

export class ForbiddenError extends AppError {
  constructor(logMessage: string) {
    super(ERROR_CODES.FORBIDDEN, 403, 'You cannot access that.', { logMessage });
  }
}

/**
 * A uniqueness or invariant the store already holds. The safe message names nothing about
 * which row collided: the colliding value is usually the very thing we must not disclose.
 */
export class ConflictError extends AppError {
  constructor(logMessage: string, cause?: unknown) {
    super(ERROR_CODES.CONFLICT, 409, 'That already exists.', { cause, logMessage });
  }
}

/** A dependency is down. Distinct from INTERNAL so a caller can sensibly retry. */
export class ServiceUnavailableError extends AppError {
  constructor(logMessage: string, cause?: unknown) {
    super(ERROR_CODES.SERVICE_UNAVAILABLE, 503, 'Temporarily unavailable.', {
      cause,
      logMessage,
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
