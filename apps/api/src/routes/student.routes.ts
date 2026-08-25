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

import type { RequestHandler } from 'express';

export function createStudentRouter(deps: {
  authorize: RequestHandler;
  arrival: ArrivalController;
  sessions: SessionControllers;
}): Router {
  const router = Router();
  router.use('/student', deps.authorize);
  router.post(
    '/student/arrival',
    validate(arrivalRequestSchema, 'body'),
    asyncHandler(deps.arrival),
  );
  router.post(
    '/student/session',
    validate(createSessionRequestSchema, 'body'),
    asyncHandler(deps.sessions.create),
  );
  router.get('/student/session/current', asyncHandler(deps.sessions.current));
  router.post(
    '/student/session/end',
    validate(endSessionRequestSchema, 'body'),
    asyncHandler(deps.sessions.end),
  );
  router.post(
    '/student/session/turn',
    validate(sessionTurnRequestSchema, 'body'),
    asyncHandler(deps.sessions.turn),
  );
  return router;
}
