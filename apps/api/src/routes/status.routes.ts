import { Router, type RequestHandler } from 'express';

import type { MetricsController } from '@/controllers/metrics.controller';
import type { StatusController } from '@/controllers/status.controller';
import { asyncHandler } from '@/middleware/async-handler';

/**
 * The two operator routes: what the service thinks of itself, and what it measured.
 *
 * `/metrics` is mounted beside `/status` and behind the same gate rather than on its own port
 * (X-04's design sketches an operator port). One process, one listener, one token: a second
 * port is a second thing to expose, firewall and get wrong, and the token already distinguishes
 * an operator from a child.
 */
export function createStatusRouter(
  controller: StatusController,
  authorize: RequestHandler,
  metrics?: MetricsController,
): Router {
  const router = Router();
  router.get('/status', authorize, asyncHandler(controller.get));
  if (metrics !== undefined) router.get('/metrics', authorize, asyncHandler(metrics.get));
  return router;
}
