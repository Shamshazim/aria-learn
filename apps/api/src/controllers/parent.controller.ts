import { adultActor } from '@/middleware/require-adult';
import {
  consentSchema,
  createChildSchema,
  createDeviceGrantSchema,
  grantIdParamSchema,
  setPictureSecretSchema,
  studentIdParamSchema,
} from '@/schemas/identity.schema';
import type { ChildProfileService } from '@/services/identity/child-profile.service';
import type { ConsentService } from '@/services/identity/consent.service';
import type { DeletionService } from '@/services/identity/deletion.service';
import type { DeviceGrantService } from '@/services/identity/device-grant.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

/**
 * The parent's own endpoints: consent, children, devices, and erasure.
 *
 * Every handler takes the actor from the middleware and never from the body, so there is no
 * parent id a caller can supply and no family a caller can name. The child and grant ids in
 * the path are checked against that actor down in SQL, not here.
 */
export type ParentControllers = Readonly<{
  recordConsent: RequestHandler;
  listConsent: RequestHandler;
  createChild: RequestHandler;
  listChildren: RequestHandler;
  setPictureSecret: RequestHandler;
  removeChild: RequestHandler;
  createDevice: RequestHandler;
  listDevices: RequestHandler;
  revokeDevice: RequestHandler;
  deleteAccount: RequestHandler;
}>;

export type ParentControllerDeps = Readonly<{
  consent: ConsentService;
  children: ChildProfileService;
  devices: DeviceGrantService;
  deletion: DeletionService;
}>;

/**
 * Path parameters are validated by middleware and re-parsed here for the same reason bodies
 * are: data crossing into the controller is parsed, never asserted (CODE-STANDARDS §1).
 */
function studentId(request: Request): string {
  return studentIdParamSchema.parse(request.validated?.params).studentId;
}

function grantId(request: Request): string {
  return grantIdParamSchema.parse(request.validated?.params).grantId;
}

export function createParentControllers(deps: ParentControllerDeps): ParentControllers {
  return { ...consentControllers(deps), ...childControllers(deps), ...deviceControllers(deps) };
}

function consentControllers(deps: ParentControllerDeps) {
  return {
    recordConsent: async (request: Request, response: Response<ApiResponse<unknown>>) => {
      const body = consentSchema.parse(request.validated?.body);
      const record = await deps.consent.record({ actor: adultActor(request), ...body });
      response.status(201).json({ data: { consentId: record.id, grantedAt: record.grantedAt } });
    },

    listConsent: async (request: Request, response: Response<ApiResponse<unknown>>) => {
      const records = await deps.consent.list(adultActor(request).adultId);
      response.status(200).json({ data: records.map(consentDto) });
    },
  };
}

function childControllers(deps: ParentControllerDeps) {
  return {
    createChild: async (request: Request, response: Response<ApiResponse<unknown>>) => {
      const body = createChildSchema.parse(request.validated?.body);
      const child = await deps.children.create({ actor: adultActor(request), ...body });
      response.status(201).json({ data: childDto(child) });
    },

    listChildren: async (request: Request, response: Response<ApiResponse<unknown>>) => {
      const children = await deps.children.list(adultActor(request));
      response.status(200).json({ data: children.map(childDto) });
    },

    setPictureSecret: async (request: Request, response: Response<ApiResponse<null>>) => {
      const body = setPictureSecretSchema.parse(request.validated?.body);
      await deps.children.setPictureSecret({
        actor: adultActor(request),
        studentId: studentId(request),
        ...body,
      });
      response.status(204).send();
    },

    removeChild: async (request: Request, response: Response<ApiResponse<null>>) => {
      await deps.children.remove(adultActor(request), studentId(request));
      response.status(204).send();
    },
  };
}

function deviceControllers(deps: ParentControllerDeps) {
  return {
    // 201 and the only response that ever carries the device secret. A client that loses it
    // issues a new grant; there is no endpoint that will repeat it.
    createDevice: async (request: Request, response: Response<ApiResponse<unknown>>) => {
      const body = createDeviceGrantSchema.parse(request.validated?.body);
      const issued = await deps.devices.issue({ actor: adultActor(request), ...body });
      response.status(201).json({ data: { ...grantDto(issued.grant), secret: issued.secret } });
    },

    listDevices: async (request: Request, response: Response<ApiResponse<unknown>>) => {
      const grants = await deps.devices.list(adultActor(request));
      response.status(200).json({ data: grants.map(grantDto) });
    },

    revokeDevice: async (request: Request, response: Response<ApiResponse<null>>) => {
      await deps.devices.revoke(adultActor(request), grantId(request));
      response.status(204).send();
    },

    deleteAccount: async (request: Request, response: Response<ApiResponse<unknown>>) => {
      const result = await deps.deletion.deleteAdult(adultActor(request));
      response.status(202).json({ data: { deletionId: result.id, stage: result.stage } });
    },
  };
}

function consentDto(record: {
  id: string;
  method: string;
  grantedAt: Date;
  revokedAt: Date | null;
}) {
  return {
    consentId: record.id,
    method: record.method,
    grantedAt: record.grantedAt.toISOString(),
    revokedAt: record.revokedAt?.toISOString() ?? null,
  };
}

function childDto(child: { id: string; displayName: string; grade: string; band: string }) {
  return { studentId: child.id, nickname: child.displayName, grade: child.grade, band: child.band };
}

function grantDto(grant: {
  id: string;
  label: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  revokedAt: Date | null;
  studentIds: readonly string[];
}) {
  return {
    grantId: grant.id,
    label: grant.label,
    createdAt: grant.createdAt.toISOString(),
    lastSeenAt: grant.lastSeenAt?.toISOString() ?? null,
    revokedAt: grant.revokedAt?.toISOString() ?? null,
    studentIds: [...grant.studentIds],
  };
}
