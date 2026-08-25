import { UnauthenticatedError } from '@/errors';
import type { AdultAuthService } from '@/services/identity/adult-auth.service';
import type { AdultActor } from '@/types/identity';

import { readCredential } from './credentials';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * The adult gate.
 *
 * `requireAdult` is the ordinary one. `requireFreshAdult` additionally asks the identity
 * provider, on this request, whether the session is still live — the check P0-26 requires
 * before a sensitive parent action, and a network round trip, which is exactly why it is a
 * second middleware rather than a flag on the first. A route that needs it says so at the
 * route, where a reviewer can see which endpoints pay for it and which do not.
 */
export type AdultGuard = Readonly<{
  requireAdult: RequestHandler;
  requireFreshAdult: RequestHandler;
}>;

export function createAdultGuard(auth: AdultAuthService): AdultGuard {
  function guard(fresh: boolean): RequestHandler {
    return (req: Request, _response: Response, next: NextFunction): void => {
      const token = readCredential(req, 'adult');
      if (token === null) {
        next(new UnauthenticatedError('request carries no adult credential'));
        return;
      }

      void auth.authenticate(token, { fresh }).then((authenticated) => {
        req.adult = authenticated.actor;
        // The verified token, kept for the one caller that needs to present it again: the
        // deletion orchestrator's provider call. Never logged — `authorization` is redacted.
        req.adultToken = token;
        next();
      }, next);
    };
  }

  return { requireAdult: guard(false), requireFreshAdult: guard(true) };
}

/** Narrows what the middleware guarantees, so a controller never re-checks or asserts. */
export function adultActor(req: Request): AdultActor {
  const actor = req.adult;
  if (actor === undefined) throw new Error('adult guard middleware was not run');
  return actor;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Request {
    adult?: AdultActor;
    adultToken?: string;
  }
}
