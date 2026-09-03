import { Router } from 'express';

import type { ParentAccessControllers } from '@/controllers/parent-access.controller';
import type { ParentControllers } from '@/controllers/parent.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import {
  createDeviceSchema,
  deviceParamsSchema,
  grantConsentSchema,
} from '@/schemas/parent-access.schema';
import {
  childParamsSchema,
  createChildRequestSchema,
  parentVoiceConsentSchema,
  updateChildRequestSchema,
} from '@/schemas/parent.schema';

import type { RequestHandler } from 'express';

/**
 * The parent app's surface (P2H-12). Wiring only.
 *
 * `router.use` puts the parent gate in front of the whole prefix rather than on each route,
 * so a route added below cannot be added without it — the failure mode this ticket exists to
 * remove is a route that quietly has no authentication at all.
 */
export function createParentRouter(
  deps: Readonly<{
    parentAuth: RequestHandler;
    controller: ParentControllers;
    /** P0-28: consent, devices, erasure and sign-out. Absent where they are not configured. */
    access?: ParentAccessControllers;
  }>,
): Router {
  const router = Router();
  router.use('/parent', deps.parentAuth);
  router.get('/parent/children', asyncHandler(deps.controller.listChildren));
  router.post(
    '/parent/children',
    validate(createChildRequestSchema, 'body'),
    asyncHandler(deps.controller.addChild),
  );
  router.patch(
    '/parent/children/:id',
    validate(childParamsSchema, 'params'),
    validate(updateChildRequestSchema, 'body'),
    asyncHandler(deps.controller.updateChild),
  );
  // Not under `/parent/children`: it is about the devices the family is signed in on, and it
  // names no child because it ends every one of them.
  router.post('/parent/sessions/revoke', asyncHandler(deps.controller.revokeSessions));
  router.post(
    '/parent/children/:id/consent/voice',
    validate(childParamsSchema, 'params'),
    validate(parentVoiceConsentSchema, 'body'),
    asyncHandler(deps.controller.grantVoiceConsent),
  );
  if (deps.access !== undefined) mountAccess(router, deps.access);
  return router;
}

/**
 * P0-28's additions, kept in their own function so the list above stays the P2H-12 surface
 * and this one is legible as the thing that was added to it.
 */
function mountAccess(router: Router, controller: ParentAccessControllers): void {
  // Consent first, because creating a child is refused without it.
  router.get('/parent/consent', asyncHandler(controller.listConsent));
  router.post(
    '/parent/consent',
    validate(grantConsentSchema, 'body'),
    asyncHandler(controller.grantConsent),
  );

  router.get('/parent/devices', asyncHandler(controller.listDevices));
  router.post(
    '/parent/devices',
    validate(createDeviceSchema, 'body'),
    asyncHandler(controller.createDevice),
  );
  router.delete(
    '/parent/devices/:id',
    validate(deviceParamsSchema, 'params'),
    asyncHandler(controller.revokeDevice),
  );

  router.delete(
    '/parent/children/:id',
    validate(childParamsSchema, 'params'),
    asyncHandler(controller.deleteChild),
  );
  // Not under `/parent/children`: it ends the account, and the children go with it.
  router.delete('/parent/account', asyncHandler(controller.deleteAccount));

  // The parent's own sessions, as distinct from their children's — which
  // `/parent/sessions/revoke` above already ends.
  router.post('/parent/sessions/sign-out-everywhere', asyncHandler(controller.signOutEverywhere));
}
