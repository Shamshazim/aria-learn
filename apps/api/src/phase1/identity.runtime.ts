import {
  CHILD_SESSION_IDLE_MS,
  argon2Hasher,
  createChildCredentialService,
  createChildSessionService,
  createParentIdentityService,
  createSupabaseTokenVerifier,
  requireChildSession,
  requireDeviceGrant,
  requireParentAuth,
} from '@/auth';
import { createDemoAuthControllers } from '@/auth/demo-session.controller';
import { createAuthControllers } from '@/controllers/auth.controller';
import { createDeviceControllers } from '@/controllers/device.controller';
import { createParentAccessControllers } from '@/controllers/parent-access.controller';
import { createParentControllers, type VoiceConsentGrant } from '@/controllers/parent.controller';
import { randomTokens } from '@/lib/tokens';
import { createChildCredentialRepository } from '@/repositories/child-credential.repository';
import { createChildSessionRepository } from '@/repositories/child-session.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import type { RouterDeps } from '@/routes';
import { createChildLoginService } from '@/services/auth/child-login.service';
import { createParentChildrenService } from '@/services/parent/children.service';
import {
  createIdleExpiryService,
  type EndSession,
  type IdleExpiryService,
} from '@/services/session/idle-expiry.service';

import { buildAccessServices, type AccessServices } from './parent-access.runtime';

import type { Phase1Repositories, Phase1RuntimeDeps } from './runtime.types';
import type { RequestHandler } from 'express';

/**
 * Everything that decides who is asking (P2H-12).
 *
 * It replaces `student-access.runtime.ts`, which returned a demo student in development and
 * `null` in production — the reason every student route answered 503 to every real family.
 *
 * The parent half is optional and the child half is not. A deployment with no Supabase project
 * configured still mounts `child-auth`, so its student routes refuse everything rather than
 * quietly letting anyone in; what it cannot do is issue a session in the first place.
 */
export type ParentConsentDeps = Readonly<{
  grant: VoiceConsentGrant;
  processorMapVersion: string;
}>;

export type IdentityRuntime = Readonly<{
  /** The gate on every student route, including the realtime negotiation. */
  childAuth: RequestHandler;
  expiry: IdleExpiryService;
  /**
   * The auth and parent routers, or `undefined` where nobody can sign in. Voice consent is
   * passed in rather than resolved here, because it only exists once voice is configured and
   * this module must not depend on the phase that configures it.
   */
  routerDeps(consent?: ParentConsentDeps): RouterDeps['identity'];
}>;

export function createIdentityRuntime(input: {
  deps: Phase1RuntimeDeps;
  repositories: Phase1Repositories;
  end: EndSession;
}): IdentityRuntime {
  const { deps, repositories } = input;
  const childSessionRepo = createChildSessionRepository(deps.pool);
  const sessions = createChildSessionService({
    sessions: childSessionRepo,
    clock: deps.clock,
    ids: deps.ids,
    tokens: deps.tokens ?? randomTokens,
  });
  const credentials = createChildCredentialService({
    credentials: createChildCredentialRepository(deps.pool),
    hasher: deps.hasher ?? argon2Hasher,
    clock: deps.clock,
  });
  const expiry = createIdleExpiryService({
    childSessions: expiredSessions(childSessionRepo, deps),
    sessions: repositories.sessions,
    events: repositories.events,
    end: input.end,
    ids: deps.ids,
    clock: deps.clock,
    logger: deps.logger,
  });
  const access = buildAccessServices({ deps, childSessions: childSessionRepo });
  const children = createParentChildrenService({
    students: repositories.students,
    credentials,
    consent: access.consent,
  });
  const login = createChildLoginService({
    children,
    credentials,
    sessions,
    students: repositories.students,
  });
  return {
    childAuth: requireChildSession({
      sessions,
      expiry,
      ...(deps.config.demoStudentId === undefined
        ? {}
        : { demoStudentId: deps.config.demoStudentId }),
    }),
    expiry,
    routerDeps: (consent) =>
      buildRouterDeps(
        { deps, children, login, sessions, access, students: repositories.students },
        consent,
      ),
  };
}

type RouterParts = Readonly<{
  deps: Phase1RuntimeDeps;
  children: ReturnType<typeof createParentChildrenService>;
  login: ReturnType<typeof createChildLoginService>;
  sessions: ReturnType<typeof createChildSessionService>;
  access: AccessServices;
  students: Phase1Repositories['students'];
}>;

function buildRouterDeps(
  parts: RouterParts,
  consent: ParentConsentDeps | undefined,
): RouterDeps['identity'] {
  const { deps, children } = parts;
  const auth = deps.config.auth;
  const demoStudentId = deps.config.demoStudentId;
  // Development with the demo flag and no Supabase project: the child routes still have to be
  // able to answer "is anybody signed in here", or the web app sends its developer to a
  // sign-in screen that cannot work.
  if (auth === undefined) {
    if (demoStudentId === undefined) return undefined;
    return {
      auth: {
        parentAuth: refuseParent,
        controller: createDemoAuthControllers({
          students: parts.students,
          demoStudentId,
          clock: deps.clock,
        }),
      },
    };
  }
  const parentAuth = requireParentAuth({
    verifier: deps.tokenVerifier ?? createSupabaseTokenVerifier(auth),
    identity: createParentIdentityService({
      parents: createParentRepository({ db: deps.pool, ids: deps.ids }),
    }),
    session: parts.access.parentSessions,
  });
  return {
    auth: {
      parentAuth,
      controller: createAuthControllers({
        login: parts.login,
        sessions: parts.sessions,
        secureCookies: deps.config.isProduction,
      }),
    },
    parent: {
      parentAuth,
      controller: createParentControllers({
        children,
        sessions: parts.sessions,
        ...(consent === undefined ? {} : { consent }),
      }),
      access: createParentAccessControllers({
        consent: parts.access.consent,
        devices: parts.access.devices,
        deletion: parts.access.deletion,
        sessions: parts.access.parentSessions,
      }),
    },
    device: deviceRouterDeps(parts),
  };
}

/** P0-28: the tablet's own surface, gated by the grant it holds rather than a parent's token. */
function deviceRouterDeps(
  parts: RouterParts,
): NonNullable<NonNullable<RouterDeps['identity']>['device']> {
  return {
    deviceAuth: requireDeviceGrant({ devices: parts.access.devices }),
    controller: createDeviceControllers({
      devices: parts.access.devices,
      children: parts.children,
      login: parts.login,
      sessions: parts.sessions,
      secureCookies: parts.deps.config.isProduction,
    }),
  };
}

/**
 * The sweeper's view of the session table: which ones are past a deadline, and how to end one.
 *
 * The two deadlines are computed here, from the clock, rather than in SQL — `now()` inside a
 * statement is a second clock, and a test that controls one of them would still be at the
 * mercy of the other.
 */
function expiredSessions(
  repository: ReturnType<typeof createChildSessionRepository>,
  deps: Phase1RuntimeDeps,
): Parameters<typeof createIdleExpiryService>[0]['childSessions'] {
  return {
    expired: async () => {
      const now = deps.clock.now();
      return repository.findExpired(now, new Date(now.getTime() - CHILD_SESSION_IDLE_MS), SWEEP);
    },
    revoke: async (session) => {
      await repository.revoke(session.id, deps.clock.now());
    },
  };
}

/** In demo mode there is no adult to authenticate, so the routes that need one are not there. */
const refuseParent: RequestHandler = (_request, response) => {
  response
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'demo' } });
};

/** One pass over the table. The sweeper runs often enough that a backlog is not expected. */
const SWEEP = 200;
