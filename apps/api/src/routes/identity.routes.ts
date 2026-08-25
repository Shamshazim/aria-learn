import { Router } from 'express';

import type { AdultAuthControllers } from '@/controllers/adult-auth.controller';
import type { ChildAuthControllers } from '@/controllers/child-auth.controller';
import type { ParentControllers } from '@/controllers/parent.controller';
import { asyncHandler } from '@/middleware/async-handler';
import type { AdultGuard } from '@/middleware/require-adult';
import type { ChildGuard } from '@/middleware/require-child';
import { validate } from '@/middleware/validate';
import {
  adultSignInSchema,
  consentSchema,
  createChildSchema,
  createDeviceGrantSchema,
  grantIdParamSchema,
  magicLinkSchema,
  openChildSessionSchema,
  setPictureSecretSchema,
  studentIdParamSchema,
} from '@/schemas/identity.schema';

/**
 * Wiring only — path, guard, validation, controller (CODE-STANDARDS §3.1).
 *
 * Read the guards down the file and you have the authorization model: `/auth` is open because
 * it is where a credential is obtained, `/parent` needs an adult, four of its endpoints need a
 * *freshly verified* adult, and `/child` needs a device or a child session and can never
 * satisfy the adult guard at all — a child token is not a signed provider JWT and fails
 * verification before any row is read.
 */
export type IdentityRouterDeps = Readonly<{
  adultAuth: AdultAuthControllers;
  parent: ParentControllers;
  childAuth: ChildAuthControllers;
  adultGuard: AdultGuard;
  childGuard: ChildGuard;
}>;

export function createIdentityRouter(deps: IdentityRouterDeps): Router {
  const router = Router();
  mountAdultAuth(router, deps);
  mountParent(router, deps);
  mountChild(router, deps);
  return router;
}

/** Open, because this is where a credential is obtained. */
function mountAdultAuth(router: Router, deps: IdentityRouterDeps): void {
  const { requireAdult } = deps.adultGuard;

  router.post(
    '/auth/adult/magic-link',
    validate(magicLinkSchema, 'body'),
    asyncHandler(deps.adultAuth.requestMagicLink),
  );
  router.post(
    '/auth/adult/session',
    validate(adultSignInSchema, 'body'),
    asyncHandler(deps.adultAuth.signIn),
  );
  router.get('/auth/adult/me', requireAdult, asyncHandler(deps.adultAuth.me));
  router.delete('/auth/adult/session', requireAdult, asyncHandler(deps.adultAuth.signOut));
}

function mountParent(router: Router, deps: IdentityRouterDeps): void {
  const { requireAdult, requireFreshAdult } = deps.adultGuard;

  router.post(
    '/parent/consent',
    requireAdult,
    validate(consentSchema, 'body'),
    asyncHandler(deps.parent.recordConsent),
  );
  router.get('/parent/consent', requireAdult, asyncHandler(deps.parent.listConsent));

  router.get('/parent/children', requireAdult, asyncHandler(deps.parent.listChildren));
  // Creating a child collects data about a minor, which is exactly where P0-26 puts the fresh
  // check — an unexpired token from an abandoned session must not be enough.
  router.post(
    '/parent/children',
    requireFreshAdult,
    validate(createChildSchema, 'body'),
    asyncHandler(deps.parent.createChild),
  );
  router.put(
    '/parent/children/:studentId/picture-secret',
    requireFreshAdult,
    validate(studentIdParamSchema, 'params'),
    validate(setPictureSecretSchema, 'body'),
    asyncHandler(deps.parent.setPictureSecret),
  );
  router.delete(
    '/parent/children/:studentId',
    requireFreshAdult,
    validate(studentIdParamSchema, 'params'),
    asyncHandler(deps.parent.removeChild),
  );

  router.get('/parent/devices', requireAdult, asyncHandler(deps.parent.listDevices));
  router.post(
    '/parent/devices',
    requireFreshAdult,
    validate(createDeviceGrantSchema, 'body'),
    asyncHandler(deps.parent.createDevice),
  );
  // Revocation is not fresh-gated on purpose: a parent reacting to a lost tablet must be able
  // to act immediately, and the action only ever removes access.
  router.delete(
    '/parent/devices/:grantId',
    requireAdult,
    validate(grantIdParamSchema, 'params'),
    asyncHandler(deps.parent.revokeDevice),
  );

  router.delete('/parent/account', requireFreshAdult, asyncHandler(deps.parent.deleteAccount));
}

function mountChild(router: Router, deps: IdentityRouterDeps): void {
  const { requireDevice, requireChildSession } = deps.childGuard;

  router.get('/child/profiles', requireDevice, asyncHandler(deps.childAuth.listProfiles));
  router.post(
    '/child/session',
    requireDevice,
    validate(openChildSessionSchema, 'body'),
    asyncHandler(deps.childAuth.open),
  );
  router.delete('/child/session', requireChildSession, asyncHandler(deps.childAuth.end));
}
