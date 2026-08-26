import { UnauthorizedError } from '@/errors';
import type { ParentActor } from '@/types/auth';

import { bearerToken, type ParentTokenVerifier } from './supabase-jwt.verifier';

import type { ParentIdentityService } from './parent-identity.service';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Every `/parent/*` route runs this, and nothing else establishes a parent (P2H-12).
 *
 * It does two things and stops: verify the token, and turn its subject into our parent row.
 * Whether this parent may touch the child in the path is a question about the family, and it
 * is answered by the service that knows about families — not here.
 */
export function requireParentAuth(deps: {
  verifier: ParentTokenVerifier;
  identity: ParentIdentityService;
}): RequestHandler {
  return (req: Request, _response: Response, next: NextFunction): void => {
    const token = bearerToken(req.headers.authorization);
    if (token === null) {
      next(new UnauthorizedError('no bearer token on a parent route'));
      return;
    }
    // A failure to verify is always a 401, whatever the verifier threw: a signature that did
    // not check out is not our outage. A failure to *resolve* the family afterwards is — the
    // database is down — so that one is left alone to become a 500.
    void deps.verifier
      .verify(token)
      .catch((error: unknown) => {
        throw error instanceof UnauthorizedError
          ? error
          : new UnauthorizedError('parent token failed verification', error);
      })
      .then((verified) => deps.identity.resolve(verified))
      .then((parent) => {
        req.parent = parent;
        next();
      }, next);
  };
}

/** The parent this request proved, for a controller whose next line has no meaning without. */
export function requireParent(request: Request): ParentActor {
  const parent = request.parent;
  if (parent === undefined) throw new Error('parent auth middleware was not run');
  return parent;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Request {
    /** Set by `requireParentAuth`. Never present on a child route. */
    parent?: ParentActor;
  }
}
