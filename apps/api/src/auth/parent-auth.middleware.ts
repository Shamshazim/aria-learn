import { UnauthorizedError } from '@/errors';
import type { ParentActor } from '@/types/auth';

import { bearerToken, type ParentTokenVerifier } from './supabase-jwt.verifier';

import type { ParentIdentityService } from './parent-identity.service';
import type { ParentSessionService } from './parent-session.service';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * Every `/parent/*` route runs this, and nothing else establishes a parent (P2H-12).
 *
 * It does three things and stops: verify the token, turn its subject into our parent row, and
 * check that the session behind that token has not been ended (P0-28). Whether this parent may
 * touch the child in the path is a question about the family, and it is answered by the
 * service that knows about families — not here.
 *
 * The third step is what makes "sign out everywhere" real. A JWT already in somebody's hands
 * cannot be recalled; the row it hangs on can, and it is read on every request rather than
 * cached, because a revocation a parent just performed has to take effect on the next one.
 */
export function requireParentAuth(deps: {
  verifier: ParentTokenVerifier;
  identity: ParentIdentityService;
  /** Optional: a deployment without the session table still authenticates, just not revocably. */
  session?: ParentSessionService;
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
      .then(async (verified) => {
        const parent = await deps.identity.resolve(verified);
        await assertSessionLive(deps, parent.id, verified.sessionKey);
        return parent;
      })
      .then((parent) => {
        req.parent = parent;
        next();
      }, next);
  };
}

/**
 * One 401 for all three ways a session ends. A parent who was signed out remotely, one whose
 * session went idle and one whose month ran out are told the same thing — sign in again —
 * because the difference is not theirs to act on and the reason belongs in the log.
 */
async function assertSessionLive(
  deps: Readonly<{ session?: ParentSessionService }>,
  parentId: string,
  sessionKey: string,
): Promise<void> {
  if (deps.session === undefined) return;
  const check = await deps.session.check({ parentId, sessionKey });
  if (check.status === 'ended') {
    throw new UnauthorizedError(`parent session ended: ${check.reason}`);
  }
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
