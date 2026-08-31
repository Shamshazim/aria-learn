import { PROTOCOL_VERSION } from '@aria/shared';

import { createApp } from '@/app';
import {
  CHILD_SESSION_IDLE_MS,
  argon2Hasher,
  createChildCredentialService,
  createChildSessionService,
  requireChildSession,
  requireParentAuth,
} from '@/auth';
import { createParentIdentityService } from '@/auth/parent-identity.service';
import { loadConfig } from '@/config';
import { createAuthControllers } from '@/controllers/auth.controller';
import { createParentControllers } from '@/controllers/parent.controller';
import { ForbiddenError, NotFoundError } from '@/errors';
import { sequentialIds, uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { randomTokens } from '@/lib/tokens';
import { createChildCredentialRepository } from '@/repositories/child-credential.repository';
import { createChildSessionRepository } from '@/repositories/child-session.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createSessionRepository } from '@/repositories/session.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import type { RouterDeps } from '@/routes';
import { endSessionRequestSchema } from '@/schemas/session.schema';
import { createChildLoginService } from '@/services/auth/child-login.service';
import { createParentChildrenService } from '@/services/parent/children.service';
import { createIdleExpiryService } from '@/services/session/idle-expiry.service';
import type { EndSession } from '@/services/session/idle-expiry.service';

import type { TestDatabase } from './db.harness';
import type { Express, RequestHandler } from 'express';
import type request from 'supertest';

/**
 * The identity stack wired against a real database and a real Argon2 (P2H-12).
 *
 * Only two things are stood in for: Supabase, faked at the verifier port because a test has
 * no business fetching somebody's JWKS, and the tutor turn behind the student routes, which
 * has suites of its own. Everything between them is what ships.
 */
export const PARENT_EMAIL = 'grown.up@example.test';
export const PARENT_TOKEN = 'valid-parent-token';
export const START = new Date('2026-08-25T10:00:00.000Z');

export const CONFIG = loadConfig(
  {
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://aria:aria@localhost:5432/aria_test',
    SUPABASE_URL: 'https://project.supabase.co',
    CHILD_SESSION_SECRET: 'c'.repeat(32),
  },
  'test',
);

export type Harness = Readonly<{
  app: Express;
  sessions: ReturnType<typeof createSessionRepository>;
  events: ReturnType<typeof createSessionEventRepository>;
  advance(ms: number): void;
  sweep(): Promise<number>;
}>;

export function buildHarness(database: TestDatabase): Harness {
  let now = new Date('2026-08-25T10:00:00.000Z');
  const clock = { now: () => now };
  const ids = uuidGenerator;
  const students = createStudentRepository({ db: database.db, ids });
  const sessionRepo = createSessionRepository({ db: database.db, ids });
  const events = createSessionEventRepository({ db: database.db, ids, clock });
  const childSessionRepo = createChildSessionRepository(database.db);
  const sessions = createChildSessionService({
    sessions: childSessionRepo,
    clock,
    ids,
    tokens: randomTokens,
  });
  const credentials = createChildCredentialService({
    credentials: createChildCredentialRepository(database.db),
    hasher: argon2Hasher,
    clock,
  });
  const expiry = createIdleExpiryService({
    childSessions: {
      expired: () =>
        childSessionRepo.findExpired(
          clock.now(),
          new Date(clock.now().getTime() - CHILD_SESSION_IDLE_MS),
          200,
        ),
      revoke: async (session) => {
        await childSessionRepo.revoke(session.id, clock.now());
      },
    },
    sessions: sessionRepo,
    events,
    end: (input) => sessionRepo.end(input.sessionId, input.reason, clock.now()),
    ids,
    clock,
    logger: createLogger({ level: 'silent' }),
  });
  const children = createParentChildrenService({ students, credentials });
  return {
    sessions: sessionRepo,
    events,
    advance: (ms) => {
      now = new Date(now.getTime() + ms);
    },
    sweep: expiry.sweep,
    app: identityApp({
      database,
      ids,
      clock,
      children,
      login: createChildLoginService({ children, credentials, sessions, students }),
      sessions,
      expiry,
      end: ownershipCheckedEnd(sessionRepo, clock),
    }),
  };
}

function identityApp(
  parts: Readonly<{
    database: TestDatabase;
    ids: typeof uuidGenerator;
    clock: Readonly<{ now(): Date }>;
    children: ReturnType<typeof createParentChildrenService>;
    login: ReturnType<typeof createChildLoginService>;
    sessions: ReturnType<typeof createChildSessionService>;
    expiry: ReturnType<typeof createIdleExpiryService>;
    end: EndSession;
  }>,
): Express {
  const { children, sessions } = parts;
  const parentAuth = requireParentAuth({
    verifier: {
      verify: (token) =>
        token === PARENT_TOKEN
          ? Promise.resolve({
              supabaseUserId: 'supabase-1',
              email: PARENT_EMAIL,
              sessionKey: 'supabase-session-1',
            })
          : Promise.reject(new Error('bad signature')),
    },
    identity: createParentIdentity(parts.database, parts.ids),
  });
  return createApp({
    config: CONFIG,
    logger: createLogger({ level: 'silent' }),
    clock: parts.clock,
    ids: sequentialIds('req'),
    identity: {
      auth: {
        parentAuth,
        controller: createAuthControllers({
          login: parts.login,
          sessions,
          secureCookies: false,
        }),
      },
      parent: { parentAuth, controller: createParentControllers({ children, sessions }) },
    },
    student: studentRoutes(requireChildSession({ sessions, expiry: parts.expiry }), parts.end),
  });
}

/** The real parent-identity service, so the auto-create edge case runs against the table. */
function createParentIdentity(database: TestDatabase, ids: typeof uuidGenerator) {
  return createParentIdentityService({
    parents: createParentRepository({ db: database.db, ids }),
  });
}

/**
 * The student surface: gated for real, and answered by a stub except where ownership is the
 * thing under test.
 *
 * `end` is the real controller over the real ownership check, because the ticket's stale-device
 * edge case — "cookie present but the tutor session belongs to another child" — is a claim
 * about that check and a stub would only agree with itself. Everything else echoes, because
 * what those routes say once a child is through is another ticket's suite.
 */
function studentRoutes(
  authorize: RequestHandler,
  end: EndSession,
): NonNullable<RouterDeps['student']> {
  const echo: RequestHandler = (req, response) => {
    response.status(200).json({
      data: { studentId: req.studentId, protocolVersion: PROTOCOL_VERSION },
    });
  };
  const endSession: RequestHandler = async (req, response) => {
    const body = endSessionRequestSchema.parse(req.validated?.body);
    await end({ sessionId: body.sessionId, studentId: req.studentId ?? '', reason: 'timeout' });
    response.status(200).json({ data: { ended: true } });
  };
  return {
    authorize,
    arrival: echo,
    sessions: { create: echo, current: echo, end: endSession, turn: echo },
  };
}

/**
 * The one ownership rule the stale-device case rests on, taken from the real end service so
 * the test is not asserting against a copy of it.
 */
export function ownershipCheckedEnd(
  sessions: ReturnType<typeof createSessionRepository>,
  clock: Readonly<{ now(): Date }>,
): EndSession {
  return async (input) => {
    const session = await sessions.findById(input.sessionId);
    if (session === null) throw new NotFoundError('session not found');
    if (session.studentId !== input.studentId)
      throw new ForbiddenError('session ownership mismatch');
    return sessions.end(session.id, input.reason, clock.now());
  };
}

/** The cookie a login handed back, ready to be set on the next request. */
export function cookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie']?.[0];
  if (header === undefined) throw new Error('no cookie was issued');
  return header.split(';')[0] ?? '';
}
