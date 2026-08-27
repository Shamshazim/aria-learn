import { ForbiddenError } from '@/errors';

import type { RequestHandler } from 'express';

export function workerOnly(token: string): RequestHandler {
  return (request, _response, next): void => {
    if (request.headers.authorization !== `Bearer ${token}`) {
      next(new ForbiddenError('voice worker authorization failed'));
      return;
    }
    next();
  };
}
