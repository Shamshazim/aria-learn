import { requireParent, type ParentSessionService } from '@/auth';
import {
  createDeviceSchema,
  deviceParamsSchema,
  grantConsentSchema,
} from '@/schemas/parent-access.schema';
import { childParamsSchema } from '@/schemas/parent.schema';
import type { ConsentService } from '@/services/parent/consent.service';
import type { DeletionService } from '@/services/parent/deletion.service';
import type { DevicesService } from '@/services/parent/devices.service';
import type { ApiResponse } from '@/types/http';
import type { ConsentRecord, DeviceGrantSummary } from '@/types/parent-access';

import type { Request, RequestHandler, Response } from 'express';

/**
 * The four things P0-28 adds to a parent's account (consent, devices, erasure, sign-out).
 *
 * A second controller rather than more of `parent.controller.ts`, so neither grows past the
 * point where a reader can hold it (§3.1). Same rule inside: every handler starts from
 * `requireParent`, and every decision belongs to the service it calls.
 */
export type ParentAccessControllers = Readonly<{
  grantConsent: RequestHandler;
  listConsent: RequestHandler;
  listDevices: RequestHandler;
  createDevice: RequestHandler;
  revokeDevice: RequestHandler;
  deleteChild: RequestHandler;
  deleteAccount: RequestHandler;
  signOutEverywhere: RequestHandler;
}>;

/** The secret is in this shape exactly once, in the response that creates the grant. */
type CreatedDevice = Readonly<{ id: string; label: string; secret: string }>;

export function createParentAccessControllers(deps: {
  consent: ConsentService;
  devices: DevicesService;
  deletion: DeletionService;
  sessions: ParentSessionService;
}): ParentAccessControllers {
  return {
    ...consentHandlers(deps),
    ...deviceHandlers(deps),
    ...deletionHandlers(deps),

    signOutEverywhere: async (request: Request, response: Response<ApiResponse<Ended>>) => {
      const ended = await deps.sessions.endAllForParent(requireParent(request).id);
      response.status(200).json({ data: { ended } });
    },
  };
}

type Ended = Readonly<{ ended: number }>;
type Deps = Parameters<typeof createParentAccessControllers>[0];

function consentHandlers(
  deps: Deps,
): Pick<ParentAccessControllers, 'grantConsent' | 'listConsent'> {
  return {
    grantConsent: async (request: Request, response: Response<ApiResponse<ConsentRecord>>) => {
      const body = grantConsentSchema.parse(request.validated?.body);
      const record = await deps.consent.grant({ parentId: requireParent(request).id, ...body });
      response.status(201).json({ data: record });
    },

    listConsent: async (
      request: Request,
      response: Response<ApiResponse<readonly ConsentRecord[]>>,
    ) => {
      // Withdrawn records included: this is the audit answer, not the current state.
      response.status(200).json({ data: await deps.consent.history(requireParent(request).id) });
    },
  };
}

function deviceHandlers(
  deps: Deps,
): Pick<ParentAccessControllers, 'listDevices' | 'createDevice' | 'revokeDevice'> {
  return {
    listDevices: async (
      request: Request,
      response: Response<ApiResponse<readonly DeviceGrantSummary[]>>,
    ) => {
      response.status(200).json({ data: await deps.devices.list(requireParent(request).id) });
    },

    createDevice: async (request: Request, response: Response<ApiResponse<CreatedDevice>>) => {
      const body = createDeviceSchema.parse(request.validated?.body);
      const issued = await deps.devices.create({
        parentId: requireParent(request).id,
        label: body.label,
        studentIds: body.childIds,
      });
      // The only response that ever carries the secret. There is no endpoint that reads it
      // back, and no column it could be read from.
      response.status(201).json({
        data: { id: issued.grant.id, label: issued.grant.label, secret: issued.secret },
      });
    },

    revokeDevice: async (request: Request, response: Response<ApiResponse<null>>) => {
      const { id } = deviceParamsSchema.parse(request.validated?.params);
      await deps.devices.revoke(requireParent(request).id, id);
      response.status(204).send();
    },
  };
}

function deletionHandlers(
  deps: Deps,
): Pick<ParentAccessControllers, 'deleteChild' | 'deleteAccount'> {
  return {
    deleteChild: async (request: Request, response: Response<ApiResponse<null>>) => {
      const { id } = childParamsSchema.parse(request.validated?.params);
      await deps.deletion.deleteChild({ parentId: requireParent(request).id, studentId: id });
      response.status(204).send();
    },

    deleteAccount: async (request: Request, response: Response<ApiResponse<null>>) => {
      // 204 even when the provider half is still owed. The parent's data is gone, which is
      // what they asked for; the ledger carries the rest and the replay finishes it.
      await deps.deletion.deleteAccount({ parentId: requireParent(request).id });
      response.status(204).send();
    },
  };
}
