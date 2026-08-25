import { ERROR_CODES, TooManyAttemptsError, isAppError } from '@/errors';
import type { ApiError } from '@/types/http';

import type { ErrorRequestHandler, NextFunction, Request, Response } from 'express';

/**
 * The last middleware, and the only place an error becomes a response.
 *
 * Two rules it exists to enforce (CODE-STANDARDS §5): the client sees `safeMessage` and
 * nothing else — never a stack trace, a SQL string, a vendor name or a key — and every
 * failure is logged with the request id that produced it, so the generic body a caller
 * receives can still be traced to a specific line in the log.
 */
export function errorHandler(): ErrorRequestHandler {
  return (error: unknown, req: Request, res: Response, next: NextFunction): void => {
    // Express cannot rewrite headers that are already on the wire; hand back to its default,
    // which destroys the connection rather than emitting a half-written body.
    if (res.headersSent) {
      next(error);
      return;
    }

    const known = isAppError(error);
    const status = known ? error.status : 500;
    const code = known ? error.code : ERROR_CODES.INTERNAL;
    const message = known ? error.safeMessage : 'Something went wrong.';

    const log = req.log;
    const payload = { err: error, requestId: req.id, code, status };

    if (status >= 500) {
      log.error(payload, 'Request failed');
    } else {
      log.warn(payload, 'Request rejected');
    }

    // The one header a safe message cannot carry: a throttled caller has to be told when to
    // come back, and for a child that number drives what the interface says (P0-28).
    if (error instanceof TooManyAttemptsError) {
      res.setHeader('Retry-After', String(error.retryAfterSeconds));
    }

    const body: ApiError = { error: { code, message, requestId: req.id } };
    res.status(status).json(body);
  };
}
