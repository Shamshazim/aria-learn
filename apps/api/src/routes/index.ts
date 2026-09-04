import { Router } from 'express';

import type { HealthController } from '@/controllers/health.controller';
import type { StatusController } from '@/controllers/status.controller';
import { idempotent } from '@/middleware/idempotency';
import { createRateLimiter } from '@/middleware/rate-limit';
import { createMemoryRateLimitStore } from '@/services/rate-limit/memory-store';
import type { IdempotencyRepository } from '@/types/idempotency';
import type { RateLimitStore } from '@/types/rate-limit';

import { createAuthRouter } from './auth.routes';
import { createDeviceRouter } from './device.routes';
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
 * The wiring `createApiRouter` supplies itself, so a caller never passes it (X-05).
 *
 * Every router now takes a `limit`; it is built here from one store rather than by each
 * caller, which is what stops two routers being handed two different sets of buckets.
 */
type WithoutLimit<T> = Omit<T, 'limit' | 'replay'>;

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
    auth: WithoutLimit<Parameters<typeof createAuthRouter>[0]>;
    parent?: WithoutLimit<Parameters<typeof createParentRouter>[0]>;
    /** P0-28: a tablet a parent trusted, signing a child in without the parent's own token. */
    device?: WithoutLimit<Parameters<typeof createDeviceRouter>[0]>;
  }>;
  status?: Readonly<{ controller: StatusController; authorize: RequestHandler }>;
  /**
   * X-05: where rate-limit buckets live. Absent means this process keeps its own, which is
   * right for one instance and for every test; a deployment running several passes the
   * Postgres store so the configured number means what it says.
   */
  rateLimitStore?: RateLimitStore;
  /**
   * X-05: where a request that already happened is recorded. Absent means a retry re-runs,
   * which is the behaviour every caller had before this ticket; the server always supplies
   * one, and a test that is not about replay may leave it out.
   */
  idempotency?: IdempotencyRepository;
  student?: WithoutLimit<Parameters<typeof createStudentRouter>[0]>;
  voice?: Readonly<{
    student: WithoutLimit<Parameters<typeof createVoiceStudentRouter>[0]>;
    worker: WithoutLimit<Parameters<typeof createVoiceWorkerRouter>[0]>;
    admin: WithoutLimit<Parameters<typeof createVoiceAdminRouter>[0]>;
  }>;
};

export function createApiRouter({
  healthController,
  identity,
  status,
  student,
  voice,
  rateLimitStore,
  idempotency,
}: RouterDeps): Router {
  const router = Router();
  // X-05. Health is deliberately not limited: it is what a load balancer calls to decide
  // whether this instance is alive, and an instance that rate-limits its own probe takes
  // itself out of rotation.
  const limit = createRateLimiter(rateLimitStore ?? createMemoryRateLimitStore());
  // A no-op where no store is configured. Stated as a handler rather than as an `if` at every
  // call site so a router reads the same either way.
  const replay: RequestHandler =
    idempotency === undefined
      ? (_request, _response, next) => {
          next();
        }
      : idempotent(idempotency);

  router.use(createHealthRouter(healthController));
  if (identity !== undefined) {
    router.use(createAuthRouter({ ...identity.auth, limit }));
    if (identity.parent !== undefined) {
      router.use(createParentRouter({ ...identity.parent, limit, replay }));
    }
    if (identity.device !== undefined) {
      router.use(createDeviceRouter({ ...identity.device, limit }));
    }
  }
  if (status !== undefined) router.use(createStatusRouter(status.controller, status.authorize));
  if (student !== undefined) router.use(createStudentRouter({ ...student, limit, replay }));
  if (voice !== undefined) {
    router.use(createVoiceStudentRouter({ ...voice.student, limit }));
    router.use(createVoiceWorkerRouter({ ...voice.worker, limit }));
    router.use(createVoiceAdminRouter({ ...voice.admin, limit }));
  }

  return router;
}
