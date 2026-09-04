import { Router } from 'express';

import type { DeviceControllers } from '@/controllers/device.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import { deviceLoginSchema } from '@/schemas/parent-access.schema';
import type { RateLimiter } from '@/types/rate-limit';

import type { RequestHandler } from 'express';

/**
 * What a trusted tablet may ask, with no parent signed in on it (P0-28). Wiring only.
 *
 * `router.use` puts the device gate in front of the whole prefix for the same reason the
 * parent router does: a route added below cannot be added without it.
 */
export function createDeviceRouter(
  deps: Readonly<{
    deviceAuth: RequestHandler;
    limit: RateLimiter;
    controller: DeviceControllers;
  }>,
): Router {
  const router = Router();
  router.use('/device', deps.deviceAuth);
  router.get('/device/children', deps.limit('read'), asyncHandler(deps.controller.listChildren));
  router.post(
    '/device/children/login',
    deps.limit('auth'),
    validate(deviceLoginSchema, 'body'),
    asyncHandler(deps.controller.login),
  );
  return router;
}
