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

/**
 * X-05: the handler carries the schema it was built from, so the router can be audited.
 *
 * `schemas/strictness.test.ts` walks the mounted app and asks every validator what it
 * parses. That is only possible because the pairing is readable from the handler itself
 * rather than being re-declared in a table beside the routers — a table that would be right
 * on the day it was written and wrong by the second new route.
 */
export type ValidatingHandler = RequestHandler &
  Readonly<{ ariaValidation: Readonly<{ schema: ZodType; target: ValidationTarget }> }>;

export function validate(schema: ZodType, target: ValidationTarget): ValidatingHandler {
  const handler: RequestHandler = (req: Request, _res: Response, next: NextFunction): void => {
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

  return Object.assign(handler, { ariaValidation: { schema, target } } as const);
}

/** Reads back what `validate` attached, for a caller walking a router it did not build. */
export function validationOf(handler: unknown): ValidatingHandler['ariaValidation'] | null {
  if (typeof handler !== 'function' && (typeof handler !== 'object' || handler === null)) {
    return null;
  }
  const attached: unknown = Object.getOwnPropertyDescriptor(handler, 'ariaValidation')?.value;
  return isValidation(attached) ? attached : null;
}

function isValidation(value: unknown): value is ValidatingHandler['ariaValidation'] {
  if (typeof value !== 'object' || value === null) return false;
  const target: unknown = Object.getOwnPropertyDescriptor(value, 'target')?.value;
  const schema: unknown = Object.getOwnPropertyDescriptor(value, 'schema')?.value;
  return typeof target === 'string' && typeof schema === 'object' && schema !== null;
}
