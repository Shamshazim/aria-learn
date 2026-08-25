import type { AdultIdentityProvider } from '@/identity';
import { adultActor } from '@/middleware/require-adult';
import { adultSignInSchema, magicLinkSchema } from '@/schemas/identity.schema';
import type { AdultAuthService } from '@/services/identity/adult-auth.service';
import type { ApiResponse } from '@/types/http';
import type { AdultRole } from '@/types/identity';

import type { Request, RequestHandler, Response } from 'express';

/**
 * HTTP in, HTTP out (CODE-STANDARDS §3.1). Every decision below this line is the service's.
 *
 * What the response omits is deliberate: no access token, no provider name, no session id
 * beyond Aria's own. A client learns who it is signed in as and nothing about how.
 */
export type AdultAuthResponse = {
  adultId: string;
  role: AdultRole;
  /** Present for a parent; a teacher owns no children and gets `null`. */
  parentId: string | null;
  sessionId: string;
};

export type AdultAuthControllers = Readonly<{
  requestMagicLink: RequestHandler;
  signIn: RequestHandler;
  me: RequestHandler;
  signOut: RequestHandler;
}>;

export type AdultAuthControllerDeps = Readonly<{
  auth: AdultAuthService;
  provider: AdultIdentityProvider;
  magicLinkRedirect: string | undefined;
}>;

export function createAdultAuthControllers(deps: AdultAuthControllerDeps): AdultAuthControllers {
  return {
    // Always 202, whether or not the address belongs to an account. Answering differently
    // would turn this endpoint into a way to ask whether someone is a customer.
    requestMagicLink: async (request: Request, response: Response<ApiResponse<null>>) => {
      const body = magicLinkSchema.parse(request.validated?.body);
      await deps.provider.sendMagicLink({
        email: body.email,
        ...(deps.magicLinkRedirect === undefined ? {} : { redirectTo: deps.magicLinkRedirect }),
      });
      response.status(202).json({ data: null });
    },

    signIn: async (request: Request, response: Response<ApiResponse<AdultAuthResponse>>) => {
      const body = adultSignInSchema.parse(request.validated?.body);
      const { actor } = await deps.auth.signIn(body);
      response.status(200).json({ data: toResponse(actor) });
    },

    me: (request: Request, response: Response<ApiResponse<AdultAuthResponse>>) => {
      response.status(200).json({ data: toResponse(adultActor(request)) });
    },

    signOut: async (request: Request, response: Response<ApiResponse<null>>) => {
      await deps.auth.signOut(adultActor(request).sessionId);
      response.status(200).json({ data: null });
    },
  };
}

function toResponse(actor: {
  adultId: string;
  role: AdultRole;
  parentId: string | null;
  sessionId: string;
}): AdultAuthResponse {
  return {
    adultId: actor.adultId,
    role: actor.role,
    parentId: actor.parentId,
    sessionId: actor.sessionId,
  };
}
