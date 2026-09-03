import { childListResponseSchema, childSessionResponseSchema } from '@aria/shared';
import type { ChildListResponse, ChildSessionResponse, ChildSummary } from '@aria/shared';

import {
  requireGrant,
  setChildCookie,
  type ChildLoginAttempt,
  type ChildSessionService,
} from '@/auth';
import { UnauthorizedError } from '@/errors';
import { deviceLoginSchema } from '@/schemas/parent-access.schema';
import type { ChildLoginResult, ChildLoginService } from '@/services/auth/child-login.service';
import type { ParentChildrenService } from '@/services/parent/children.service';
import type { DevicesService } from '@/services/parent/devices.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

/**
 * What a trusted tablet can do without a parent signed in on it (P0-28).
 *
 * Two routes, and both are narrower than their `/auth` equivalents on purpose. The picker
 * shows only the children this grant names, and a sign-in is refused for anyone else — so a
 * tablet that leaves the house is a tablet that can reach one child's account, not a family's.
 */
export type DeviceControllers = Readonly<{
  listChildren: RequestHandler;
  login: RequestHandler;
}>;

export function createDeviceControllers(deps: {
  devices: DevicesService;
  children: ParentChildrenService;
  login: ChildLoginService;
  sessions: ChildSessionService;
  secureCookies: boolean;
}): DeviceControllers {
  return {
    listChildren: async (request: Request, response: Response<ApiResponse<ChildListResponse>>) => {
      const grant = requireGrant(request);
      const family = await deps.children.list(grant.parentId);
      const scoped = await filterToGrant(deps, grant.id, family);
      response.status(200).json({ data: childListResponseSchema.parse({ children: scoped }) });
    },

    login: async (request: Request, response: Response<ApiResponse<ChildSessionResponse>>) => {
      const grant = requireGrant(request);
      const body = deviceLoginSchema.parse(request.validated?.body);

      // The scope check, before the credential is even looked at. A device asking about a
      // child it was never given is refused the same way a wrong PIN is: this tablet is not
      // owed the difference between "not your child" and "wrong".
      if (!(await deps.devices.permits(grant.id, body.childId))) {
        throw new UnauthorizedError(
          `device grant ${grant.id} is not scoped to student ${body.childId}`,
        );
      }

      const result = await deps.login.login({
        parentId: grant.parentId,
        childId: body.childId,
        attempt: attemptOf(body),
        deviceLabel: grant.label,
        deviceGrantId: grant.id,
      });

      respondWithSession(deps, response, result);
    },
  };
}

type Deps = Parameters<typeof createDeviceControllers>[0];

async function filterToGrant(
  deps: Deps,
  grantId: string,
  family: readonly ChildSummary[],
): Promise<ChildSummary[]> {
  const allowed = await Promise.all(
    family.map(async (child) => ((await deps.devices.permits(grantId, child.id)) ? child : null)),
  );
  return allowed.filter((child) => child !== null);
}

/** Absent, not `undefined` — the two differ under `exactOptionalPropertyTypes`. */
function attemptOf(body: ReturnType<typeof deviceLoginSchema.parse>): ChildLoginAttempt {
  return {
    ...(body.pin === undefined ? {} : { pin: body.pin }),
    ...(body.pictureSequence === undefined ? {} : { pictureSequence: body.pictureSequence }),
  };
}

function respondWithSession(
  deps: Deps,
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
