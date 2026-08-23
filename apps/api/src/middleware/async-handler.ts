import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Sends a rejected promise to the error middleware.
 *
 * Express 5 already forwards rejections from async handlers, but wrapping is explicit and
 * survives a version change. It is what keeps `try/catch` boilerplate out of every
 * controller (CODE-STANDARDS §3.1).
 */
export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => unknown,
): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(handler(req, res, next)).catch(next);
  };
}
