import { Router } from 'express';

import type { HealthController } from '@/controllers/health.controller';
import { asyncHandler } from '@/middleware/async-handler';

/**
 * Path to middleware to controller, and nothing else. A router that contains a decision has
 * stopped being a router (CODE-STANDARDS §3.1).
 */
export function createHealthRouter(controller: HealthController): Router {
  const router = Router();

  router.get('/health', asyncHandler(controller.get));

  return router;
}
