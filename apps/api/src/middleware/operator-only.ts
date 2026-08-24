import type { NextFunction, Request, RequestHandler, Response } from 'express';

export function operatorOnly(token: string): RequestHandler {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (request.headers.authorization === `Bearer ${token}`) {
      next();
      return;
    }
    response.status(404).json({ error: { code: 'NOT_FOUND', message: 'Not found.' } });
  };
}
