import { Router } from 'express';

import type { AuthControllers } from '@/controllers/auth.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import { childLoginRequestSchema } from '@/schemas/auth.schema';

import type { RequestHandler } from 'express';

/**
 * Signing a child in and out (P2H-12). Wiring only.
 *
 * Login sits behind the parent's own session: the device is a family's, and the adult who set
 * it up is what says which family. The picker's list is `GET /parent/children` — one list, one
 * route. Logout and refresh sit behind nothing, because a child whose parent's token has
 * expired must still be able to leave, and a session that can only be ended by a signed-in
 * adult is a session that outlives the child using it.
 */
export function createAuthRouter(
  deps: Readonly<{ parentAuth: RequestHandler; controller: AuthControllers }>,
): Router {
  const router = Router();
  router.post(
    '/auth/child/login',
    deps.parentAuth,
    validate(childLoginRequestSchema, 'body'),
    asyncHandler(deps.controller.login),
  );
  router.post('/auth/child/logout', asyncHandler(deps.controller.logout));
  router.post('/auth/child/refresh', asyncHandler(deps.controller.refresh));
  return router;
}
