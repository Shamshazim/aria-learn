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

/**
 * Nobody is signed in, or their proof did not check out (P2H-12).
 *
 * The safe message says nothing about which half failed. A response that distinguished "no
 * such child" from "wrong PIN" would turn the picker into a way of enumerating a family.
 */
export class UnauthorizedError extends AppError {
  constructor(logMessage: string, cause?: unknown) {
    super(ERROR_CODES.UNAUTHORIZED, 401, 'Please sign in again.', { cause, logMessage });
  }
}

/** Too many wrong attempts (P2H-12). The child screen renders one fixed sentence for this. */
export class LockedError extends AppError {
  constructor(logMessage: string) {
    super(ERROR_CODES.LOCKED, 423, 'Ask a grown-up for help.', { logMessage });
  }
}

export class ForbiddenError extends AppError {
  constructor(logMessage: string) {
    super(ERROR_CODES.FORBIDDEN, 403, 'You cannot access that.', { logMessage });
  }
}

/**
 * P0-28: no verifiable parental consent on file.
 *
 * Also a 403, and deliberately not the same one. The parent has proved who they are; what is
 * missing is a step they can take, so the message names it and the code lets the parent app
 * route to the screen that takes it.
 */
export class ConsentRequiredError extends AppError {
  constructor(logMessage: string) {
    super(ERROR_CODES.CONSENT_REQUIRED, 403, 'Please confirm you are the grown-up first.', {
      logMessage,
    });
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

/**
 * X-05: the actor has spent its budget for this route class.
 *
 * It carries `retryAfterSeconds` because a 429 without one asks every client to invent its
 * own backoff, and the ones that guess badly are exactly the ones already sending too much.
 * The error handler puts it on the wire as `Retry-After`; the safe message stays a sentence
 * a child could read, since the child UI is one of the things that receives it.
 */
export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(logMessage: string, retryAfterSeconds: number) {
    super(ERROR_CODES.RATE_LIMITED, 429, 'Let us slow down for a moment.', { logMessage });
    // A `Retry-After` of 0 tells a client to retry immediately, which is the one thing a
    // spent bucket must not invite. One second is the floor.
    this.retryAfterSeconds = Math.max(1, Math.ceil(retryAfterSeconds));
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
