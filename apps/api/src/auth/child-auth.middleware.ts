import { UnauthorizedError } from '@/errors';
import type { IdleExpiryService } from '@/services/session/idle-expiry.service';
import type { ChildSessionRecord } from '@/types/auth';

import { readChildCookie } from './child-session.cookie';

import type { ChildSessionService } from './child-session.service';
import type { NextFunction, Request, RequestHandler, Response } from 'express';

/**
 * The gate on every student route, the realtime negotiation included (P2H-12).
 *
 * It replaces `student-access.runtime.ts`, which answered "the demo student" in development
 * and `null` in production — which is to say the product had no way for a real child to reach
 * a real session. A request now gets a student id from a cookie bound to that child and their
 * parent, or it gets a 401.
 *
 * The demo student survives as a development-only branch, and only because `config` refuses to
 * hand one over unless `NODE_ENV=development` *and* `ALLOW_DEMO_STUDENT=true`. There is no
 * arrangement of environment variables that reaches it in production.
 */
export function requireChildSession(deps: {
  sessions: ChildSessionService;
  expiry: IdleExpiryService;
  demoStudentId?: string;
}): RequestHandler {
  const demoStudentId = deps.demoStudentId;
  return (req: Request, _response: Response, next: NextFunction): void => {
    if (demoStudentId !== undefined) {
      req.studentId = demoStudentId;
      next();
      return;
    }
    const cookie = readChildCookie(req);
    if (cookie === null) {
      next(new UnauthorizedError('no child session cookie'));
      return;
    }
    void resolve(deps, req, cookie).then(() => {
      next();
    }, next);
  };
}

async function resolve(
  deps: Parameters<typeof requireChildSession>[0],
  req: Request,
  cookie: string,
): Promise<void> {
  const checked = await deps.sessions.check(cookie);
  if (checked.status === 'idle') {
    // The cookie is already revoked by the time we get here; the lesson it was in the middle
    // of is what is left to close.
    await deps.expiry.endFor(checked.session);
    throw new UnauthorizedError('child session expired while idle');
  }
  if (checked.status === 'unknown') throw new UnauthorizedError('child session is not live');
  req.studentId = checked.session.studentId;
  req.childSession = checked.session;
}

declare module 'express-serve-static-core' {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Request {
    /** The child this request proved. Every student controller reads it and nothing else. */
    studentId?: string;
    /** The row behind the cookie, for the handlers that report or rotate it. */
    childSession?: ChildSessionRecord;
  }
}
