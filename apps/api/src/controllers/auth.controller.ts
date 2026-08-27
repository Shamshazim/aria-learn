import { childSessionResponseSchema } from '@aria/shared';
import type { ChildSessionResponse } from '@aria/shared';

import {
  clearChildCookie,
  readChildCookie,
  requireParent,
  setChildCookie,
  type ChildSessionService,
  type ChildLoginAttempt,
} from '@/auth';
import { UnauthorizedError } from '@/errors';
import { childLoginRequestSchema } from '@/schemas/auth.schema';
import type { ChildLoginResult, ChildLoginService } from '@/services/auth/child-login.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

/**
 * The four things a device does about who is using it (P2H-12).
 *
 * Every one of them ends with a `Set-Cookie` or a cleared cookie and a body that says nothing
 * secret. The session token appears in the header and never in the JSON, so a screenshot of a
 * network tab is not a way into a child's account.
 */
export type AuthControllers = Readonly<{
  login: RequestHandler;
  logout: RequestHandler;
  refresh: RequestHandler;
}>;

export function createAuthControllers(deps: {
  login: ChildLoginService;
  sessions: ChildSessionService;
  /** False only in local development, where there is no TLS for a secure cookie to need. */
  secureCookies: boolean;
}): AuthControllers {
  return {
    login: async (request: Request, response: Response<ApiResponse<ChildSessionResponse>>) => {
      const parent = requireParent(request);
      const body = childLoginRequestSchema.parse(request.validated?.body);
      const result = await deps.login.login({
        parentId: parent.id,
        childId: body.childId,
        attempt: attemptOf(body),
        deviceLabel: body.deviceLabel ?? null,
      });
      respondWithSession(deps, response, result);
    },

    logout: async (request: Request, response: Response<ApiResponse<{ signedOut: true }>>) => {
      const cookie = readChildCookie(request);
      if (cookie !== null) await deps.login.logout(cookie);
      clearChildCookie(response, deps.secureCookies);
      response.status(200).json({ data: { signedOut: true } });
    },

    refresh: async (request: Request, response: Response<ApiResponse<ChildSessionResponse>>) => {
      const cookie = readChildCookie(request);
      const result = cookie === null ? null : await deps.login.refresh(cookie);
      if (result === null) {
        // A refresh that cannot be honoured takes the dead cookie with it, so the device
        // lands on the picker rather than retrying with something that will never work.
        clearChildCookie(response, deps.secureCookies);
        throw new UnauthorizedError('child session could not be refreshed');
      }
      respondWithSession(deps, response, result);
    },
  };
}

/**
 * Absent, not `undefined`: `exactOptionalPropertyTypes` makes those different, and a login
 * that offered `pin: undefined` would read as "this child tried a PIN" to the service.
 */
function attemptOf(body: ReturnType<typeof childLoginRequestSchema.parse>): ChildLoginAttempt {
  return {
    ...(body.pin === undefined ? {} : { pin: body.pin }),
    ...(body.pictureSequence === undefined ? {} : { pictureSequence: body.pictureSequence }),
  };
}

function respondWithSession(
  deps: Parameters<typeof createAuthControllers>[0],
  response: Response<ApiResponse<ChildSessionResponse>>,
  result: ChildLoginResult,
): void {
  const { session } = result.issued;
  setChildCookie(response, result.issued.token, {
    expiresAt: session.expiresAt,
    secure: deps.secureCookies,
  });
  response.status(200).json({
    data: childSessionResponseSchema.parse({
      child: result.child,
      expiresAt: session.expiresAt.toISOString(),
      idleExpiresAt: deps.sessions.idleDeadline(session).toISOString(),
    }),
  });
}
