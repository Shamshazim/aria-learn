import { Router } from 'express';

import type { ArrivalController } from '@/controllers/arrival.controller';
import type { SessionControllers } from '@/controllers/session.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import { arrivalRequestSchema } from '@/schemas/arrival.schema';
import {
  createSessionRequestSchema,
  endSessionRequestSchema,
  sessionTurnRequestSchema,
} from '@/schemas/session.schema';
import type { RateLimiter } from '@/types/rate-limit';

import type { RequestHandler } from 'express';

/**
 * X-05: the limit goes on after `authorize`, never before.
 *
 * Order is the whole point. Ahead of authentication the request has proved nothing, so every
 * child in a school would be billed to one anonymous bucket keyed by their shared address.
 * After it, `req.studentId` is set and each child spends their own.
 */
export function createStudentRouter(deps: {
  authorize: RequestHandler;
  limit: RateLimiter;
  /** X-05: makes a mutating route safe to send twice. See `middleware/idempotency`. */
  replay: RequestHandler;
  arrival: ArrivalController;
  sessions: SessionControllers;
}): Router {
  const router = Router();
  router.use('/student', deps.authorize);
  router.post(
    '/student/arrival',
    deps.limit('session'),
    validate(arrivalRequestSchema, 'body'),
    asyncHandler(deps.arrival),
  );
  router.post(
    '/student/session',
    deps.limit('session'),
    deps.replay,
    validate(createSessionRequestSchema, 'body'),
    asyncHandler(deps.sessions.create),
  );
  router.get('/student/session/current', deps.limit('read'), asyncHandler(deps.sessions.current));
  router.post(
    '/student/session/end',
    deps.limit('session'),
    deps.replay,
    validate(endSessionRequestSchema, 'body'),
    asyncHandler(deps.sessions.end),
  );
  // The expensive one: every turn is a model call, so it has a budget of its own.
  router.post(
    '/student/session/turn',
    deps.limit('turn'),
    deps.replay,
    validate(sessionTurnRequestSchema, 'body'),
    asyncHandler(deps.sessions.turn),
  );
  return router;
}
