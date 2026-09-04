import { Router } from 'express';

import type { AuthControllers } from '@/controllers/auth.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import { childLoginRequestSchema } from '@/schemas/auth.schema';
import type { RateLimiter } from '@/types/rate-limit';

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
  deps: Readonly<{ parentAuth: RequestHandler; limit: RateLimiter; controller: AuthControllers }>,
): Router {
  const router = Router();
  // X-05: `auth` is the tightest class. Login is where volume is itself the attack — P2H-12
  // locks a child's credential after repeated failures, and this bounds how fast an attacker
  // can walk a family towards that lock. The limit sits *before* `parentAuth` here, because
  // an unauthenticated caller guessing at the door is exactly what needs bounding.
  router.post(
    '/auth/child/login',
    deps.limit('auth'),
    deps.parentAuth,
    validate(childLoginRequestSchema, 'body'),
    asyncHandler(deps.controller.login),
  );
  // Logout is never limited into failure: a child must always be able to leave.
  router.post('/auth/child/logout', asyncHandler(deps.controller.logout));
  router.post('/auth/child/refresh', deps.limit('read'), asyncHandler(deps.controller.refresh));
  return router;
}
