import { childActor, deviceSecret } from '@/middleware/require-child';
import { openChildSessionSchema } from '@/schemas/identity.schema';
import type { ChildAuthService } from '@/services/identity/child-auth.service';
import type { ChildProfileSummary } from '@/types/device-access';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

/**
 * The three requests a child's device makes before a tutoring session exists.
 *
 * The picker response is the narrowest thing this API returns: a picture and a nickname, for
 * children this device was granted. It is served to a request that has proven only that a
 * parent authorised the device, so it must contain nothing a stranger holding that device
 * should not see — no grade, no history, no sibling who was not granted.
 */
export type ChildProfileResponse = {
  studentId: string;
  nickname: string;
  avatarKey: string | null;
};

export type ChildSessionResponse = {
  sessionId: string;
  studentId: string;
  /** The child's session credential. Returned once, held by the device, never repeated. */
  token: string;
  expiresAt: string;
};

export type ChildAuthControllers = Readonly<{
  listProfiles: RequestHandler;
  open: RequestHandler;
  end: RequestHandler;
}>;

export function createChildAuthControllers(auth: ChildAuthService): ChildAuthControllers {
  return {
    listProfiles: async (
      request: Request,
      response: Response<ApiResponse<readonly ChildProfileResponse[]>>,
    ) => {
      const profiles = await auth.listProfiles(deviceSecret(request));
      response.status(200).json({ data: profiles.map(profileDto) });
    },

    open: async (request: Request, response: Response<ApiResponse<ChildSessionResponse>>) => {
      const body = openChildSessionSchema.parse(request.validated?.body);
      const issued = await auth.open({ deviceSecret: deviceSecret(request), ...body });

      response.status(201).json({
        data: {
          sessionId: issued.session.id,
          studentId: issued.session.studentId,
          token: issued.token,
          expiresAt: issued.session.absoluteExpiresAt.toISOString(),
        },
      });
    },

    end: async (request: Request, response: Response<ApiResponse<null>>) => {
      await auth.end(childActor(request).sessionId);
      response.status(204).send();
    },
  };
}

function profileDto(profile: ChildProfileSummary): ChildProfileResponse {
  return {
    studentId: profile.studentId,
    nickname: profile.nickname,
    avatarKey: profile.avatarKey,
  };
}
