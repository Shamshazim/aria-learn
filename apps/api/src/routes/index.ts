import { Router } from 'express';

import type { HealthController } from '@/controllers/health.controller';

import { createHealthRouter } from './health.routes';

/**
 * Mounts every versioned router under one prefix.
 *
 * The version lives here rather than inside each router so `/api/v2` can be introduced by
 * adding a second mount, without every router learning about versioning.
 */
export const API_PREFIX = '/api/v1';

export type RouterDeps = {
  healthController: HealthController;
};

export function createApiRouter({ healthController }: RouterDeps): Router {
  const router = Router();

  router.use(createHealthRouter(healthController));

  return router;
}
