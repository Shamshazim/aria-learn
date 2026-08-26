import { Router } from 'express';

import type { ParentControllers } from '@/controllers/parent.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
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
  deps: Readonly<{ parentAuth: RequestHandler; controller: ParentControllers }>,
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
  router.post(
    '/parent/children/:id/consent/voice',
    validate(childParamsSchema, 'params'),
    validate(parentVoiceConsentSchema, 'body'),
    asyncHandler(deps.controller.grantVoiceConsent),
  );
  return router;
}
