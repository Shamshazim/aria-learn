import { childListResponseSchema, childSummarySchema } from '@aria/shared';
import type { ChildListResponse, ChildSummary } from '@aria/shared';

import { requireParent, type ChildSessionService } from '@/auth';
import { NotFoundError } from '@/errors';
import {
  childParamsSchema,
  createChildRequestSchema,
  parentVoiceConsentSchema,
  updateChildRequestSchema,
} from '@/schemas/parent.schema';
import type { ParentChildrenService } from '@/services/parent/children.service';
import type { ApiResponse } from '@/types/http';
import type { VoiceConsent } from '@/types/voice';

import type { Request, RequestHandler, Response } from 'express';

/**
 * What a signed-in parent can do to their own family, and nothing else (P2H-12).
 *
 * Every handler starts from `requireParent`, and every one that names a child hands the check
 * to the service rather than doing it here: a controller that decided who owns whom would be a
 * business rule in the HTTP layer, and the second copy of it would be the one that was wrong.
 */
export type ParentControllers = Readonly<{
  listChildren: RequestHandler;
  addChild: RequestHandler;
  updateChild: RequestHandler;
  grantVoiceConsent: RequestHandler;
  /** Every device, at once. The rule this exists for: "a parent can revoke all child sessions". */
  revokeSessions: RequestHandler;
}>;

type RevokedSessions = Readonly<{ revoked: number }>;

/** Present only where the deployment has voice configured; absent means the route is not mounted. */
export type VoiceConsentGrant = (
  input: Readonly<{
    parentId: string;
    studentId: string;
    processorCategories: readonly string[];
    retainReadingAudio: boolean;
    verificationReference: string;
    grantedBy: string;
    processorMapVersion: string;
  }>,
) => Promise<VoiceConsent>;

export function createParentControllers(deps: {
  children: ParentChildrenService;
  sessions: Pick<ChildSessionService, 'endAllForParent'>;
  consent?: Readonly<{ grant: VoiceConsentGrant; processorMapVersion: string }>;
}): ParentControllers {
  return {
    revokeSessions: async (request: Request, response: Response<ApiResponse<RevokedSessions>>) => {
      const revoked = await deps.sessions.endAllForParent(requireParent(request).id);
      // A count, never the sessions: a device label is a fact about a family's home.
      response.status(200).json({ data: { revoked: revoked.length } });
    },

    listChildren: async (request: Request, response: Response<ApiResponse<ChildListResponse>>) => {
      const children = await deps.children.list(requireParent(request).id);
      response.status(200).json({ data: childListResponseSchema.parse({ children }) });
    },

    addChild: async (request: Request, response: Response<ApiResponse<ChildSummary>>) => {
      const body = createChildRequestSchema.parse(request.validated?.body);
      const child = await deps.children.add(requireParent(request).id, {
        displayName: body.displayName,
        grade: body.grade,
        ...(body.avatar === undefined ? {} : { avatar: body.avatar }),
      });
      response.status(201).json({ data: childSummarySchema.parse(child) });
    },

    updateChild: async (request: Request, response: Response<ApiResponse<ChildSummary>>) => {
      const { id } = childParamsSchema.parse(request.validated?.params);
      const body = updateChildRequestSchema.parse(request.validated?.body);
      const child = await deps.children.update(requireParent(request).id, id, body);
      response.status(200).json({ data: childSummarySchema.parse(child) });
    },

    grantVoiceConsent: async (request: Request, response: Response<ApiResponse<VoiceConsent>>) => {
      const consent = deps.consent;
      if (consent === undefined) throw new NotFoundError('voice is not configured');
      const parent = requireParent(request);
      const { id } = childParamsSchema.parse(request.validated?.params);
      const body = parentVoiceConsentSchema.parse(request.validated?.body);
      // Ownership first: consent for a child who is not yours is not a consent problem.
      await deps.children.requireOwned(parent.id, id);
      response.status(200).json({
        data: await consent.grant({
          ...body,
          parentId: parent.id,
          studentId: id,
          grantedBy: parent.id,
          processorMapVersion: consent.processorMapVersion,
        }),
      });
    },
  };
}
