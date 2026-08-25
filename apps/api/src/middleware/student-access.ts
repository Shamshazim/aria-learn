import { ServiceUnavailableError } from '@/errors';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

export type StudentAccessResolver = Readonly<{
  resolve(request: Request): Promise<Readonly<{ studentId: string }> | null>;
}>;

export function requireStudentAccess(resolver: StudentAccessResolver): RequestHandler {
  return (req: Request, _response: Response, next: NextFunction): void => {
    void resolver.resolve(req).then((actor) => {
      if (actor === null) {
        next(new ServiceUnavailableError('child session authentication is not configured'));
        return;
      }
      req.studentId = actor.studentId;
      next();
    }, next);
  };
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Request {
    studentId?: string;
  }
}
