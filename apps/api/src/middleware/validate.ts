import { ValidationError } from '@/errors';

import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { ZodType } from 'zod';

/**
 * Parses one part of the request against a schema, before the controller runs.
 *
 * Two things this buys, both from CODE-STANDARDS §1 and §3.1: input crossing the trust
 * boundary is *parsed* rather than asserted, and the controller receives typed input so it
 * contains no validation branching of its own.
 *
 * The parsed value is written to `req.validated`, never back over `req.body`: overwriting the
 * raw input hides what actually arrived from anything that logs or re-reads it.
 */
export type ValidationTarget = 'body' | 'query' | 'params';

export function validate(schema: ZodType, target: ValidationTarget): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req[target]);

    if (!result.success) {
      const detail = result.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');

      next(new ValidationError(`${target} failed validation — ${detail}`, result.error));
      return;
    }

    req.validated = { ...req.validated, [target]: result.data };
    next();
  };
}
