import { Router } from 'express';

import type { HealthController } from '@/controllers/health.controller';
import type { StatusController } from '@/controllers/status.controller';

import { createHealthRouter } from './health.routes';
import { createStatusRouter } from './status.routes';
import { createStudentRouter } from './student.routes';

import type { RequestHandler } from 'express';

/**
 * Mounts every versioned router under one prefix.
 *
 * The version lives here rather than inside each router so `/api/v2` can be introduced by
 * adding a second mount, without every router learning about versioning.
 */
export const API_PREFIX = '/api/v1';

export type RouterDeps = {
  healthController: HealthController;
  status?: Readonly<{ controller: StatusController; authorize: RequestHandler }>;
  student?: Parameters<typeof createStudentRouter>[0];
};

export function createApiRouter({ healthController, status, student }: RouterDeps): Router {
  const router = Router();

  router.use(createHealthRouter(healthController));
  if (status !== undefined) router.use(createStatusRouter(status.controller, status.authorize));
  if (student !== undefined) router.use(createStudentRouter(student));

  return router;
}
