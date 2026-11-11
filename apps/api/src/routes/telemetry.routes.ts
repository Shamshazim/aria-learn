import { Router } from 'express';

import type { TelemetryController } from '@/controllers/telemetry.controller';
import { asyncHandler } from '@/middleware/async-handler';
import { validate } from '@/middleware/validate';
import { turnTimingRequestSchema } from '@/schemas/telemetry.schema';
import type { RateLimiter } from '@/types/rate-limit';

import type { RequestHandler } from 'express';

/**
 * The client timing route (X-04 part 2).
 *
 * Mounted under the same child gate as `/student`, because the report is about one child's
 * session and the only way to know whose session it is, is to know whose request it is. The
 * limit goes on after `authorize` for the reason `student.routes.ts` gives at length: ahead of
 * it, every child behind one school's address would spend one anonymous bucket.
 *
 * There is no `replay` here, and that is deliberate rather than forgotten. Idempotency exists
 * so a retried request does not happen twice; a timing that arrives twice is two observations
 * in a histogram of thousands, and paying for a stored response on every measurement to avoid
 * that would be the more expensive mistake (X-05).
 */
export function createTelemetryRouter(deps: {
  authorize: RequestHandler;
  limit: RateLimiter;
  controller: TelemetryController;
}): Router {
  const router = Router();
  router.use('/telemetry', deps.authorize);
  router.post(
    '/telemetry/turn',
    deps.limit('telemetry'),
    validate(turnTimingRequestSchema, 'body'),
    asyncHandler(deps.controller.turn),
  );
  return router;
}
