import { NotFoundError } from '@/errors';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Registered after every router: anything still unmatched is a 404.
 *
 * It raises the same `AppError` any other layer would, so an unknown route and a missing
 * record produce an identically shaped body.
 */
export function notFound(): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    next(new NotFoundError(`No route for ${req.method} ${req.originalUrl}`));
  };
}
