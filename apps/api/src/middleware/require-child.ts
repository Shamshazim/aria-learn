import { UnauthenticatedError } from '@/errors';
import type { ChildAuthService } from '@/services/identity/child-auth.service';
import type { ChildActor } from '@/types/device-access';

import { readCredential } from './credentials';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * The child gate, and the device gate in front of it.
 *
 * `requireDevice` proves only that the request comes from a device a parent authorised — that
 * is enough to show the picker, and deliberately not enough to do anything else. A child's own
 * session comes from `requireChildSession`, and the student id it yields comes from the
 * session row, never from the request: a child cannot name a sibling and be believed.
 */
export type ChildGuard = Readonly<{
  requireDevice: RequestHandler;
  requireChildSession: RequestHandler;
}>;

export function createChildGuard(auth: ChildAuthService): ChildGuard {
  return {
    requireDevice: (req: Request, _response: Response, next: NextFunction): void => {
      const secret = readCredential(req, 'device');
      if (secret === null) {
        next(new UnauthenticatedError('request carries no device credential'));
        return;
      }
      req.deviceSecret = secret;
      next();
    },

    requireChildSession: (req: Request, _response: Response, next: NextFunction): void => {
      const token = readCredential(req, 'childSession');
      if (token === null) {
        next(new UnauthenticatedError('request carries no child session credential'));
        return;
      }

      void auth.authenticate(token).then((actor) => {
        req.child = actor;
        req.studentId = actor.studentId;
        next();
      }, next);
    },
  };
}

export function childActor(req: Request): ChildActor {
  const actor = req.child;
  if (actor === undefined) throw new Error('child guard middleware was not run');
  return actor;
}

export function deviceSecret(req: Request): string {
  const secret = req.deviceSecret;
  if (secret === undefined) throw new Error('device guard middleware was not run');
  return secret;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Request {
    child?: ChildActor;
    deviceSecret?: string;
  }
}
