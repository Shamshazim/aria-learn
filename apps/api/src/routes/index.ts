import { Router } from 'express';

import type { HealthController } from '@/controllers/health.controller';
import type { StatusController } from '@/controllers/status.controller';

import { createAuthRouter } from './auth.routes';
import { createHealthRouter } from './health.routes';
import { createParentRouter } from './parent.routes';
import { createStatusRouter } from './status.routes';
import { createStudentRouter } from './student.routes';
import {
  createVoiceAdminRouter,
  createVoiceStudentRouter,
  createVoiceWorkerRouter,
} from './voice.routes';

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
  /**
   * P2H-12. Absent where no Supabase project is configured *and* no demo child is allowed —
   * nobody can sign in at all. `parent` is absent in development's demo mode, where there is
   * no adult to authenticate and nothing for a parent route to act on.
   */
  identity?: Readonly<{
    auth: Parameters<typeof createAuthRouter>[0];
    parent?: Parameters<typeof createParentRouter>[0];
  }>;
  status?: Readonly<{ controller: StatusController; authorize: RequestHandler }>;
  student?: Parameters<typeof createStudentRouter>[0];
  voice?: Readonly<{
    student: Parameters<typeof createVoiceStudentRouter>[0];
    worker: Parameters<typeof createVoiceWorkerRouter>[0];
    admin: Parameters<typeof createVoiceAdminRouter>[0];
  }>;
};

export function createApiRouter({
  healthController,
  identity,
  status,
  student,
  voice,
}: RouterDeps): Router {
  const router = Router();

  router.use(createHealthRouter(healthController));
  if (identity !== undefined) {
    router.use(createAuthRouter(identity.auth));
    if (identity.parent !== undefined) router.use(createParentRouter(identity.parent));
  }
  if (status !== undefined) router.use(createStatusRouter(status.controller, status.authorize));
  if (student !== undefined) router.use(createStudentRouter(student));
  if (voice !== undefined) {
    router.use(createVoiceStudentRouter(voice.student));
    router.use(createVoiceWorkerRouter(voice.worker));
    router.use(createVoiceAdminRouter(voice.admin));
  }

  return router;
}
