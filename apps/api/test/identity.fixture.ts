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
import { sequentialIds, uuidGenerator } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { randomTokens } from '@/lib/tokens';
import { createChildCredentialRepository } from '@/repositories/child-credential.repository';
import { createChildSessionRepository } from '@/repositories/child-session.repository';
import { createParentRepository } from '@/repositories/parent.repository';
import { createSessionEventRepository } from '@/repositories/session-event.repository';
import { createSessionRepository } from '@/repositories/session.repository';
import { createStudentRepository } from '@/repositories/student.repository';
import { createChildLoginService } from '@/services/auth/child-login.service';
import { createParentChildrenService } from '@/services/parent/children.service';
import { createIdleExpiryService } from '@/services/session/idle-expiry.service';

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
  }>,
): Express {
  const { children, sessions } = parts;
  const parentAuth = requireParentAuth({
    verifier: {
      verify: (token) =>
        token === PARENT_TOKEN
          ? Promise.resolve({ supabaseUserId: 'supabase-1', email: PARENT_EMAIL })
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
          children,
          login: parts.login,
          sessions,
          secureCookies: false,
        }),
      },
      parent: { parentAuth, controller: createParentControllers({ children }) },
    },
    student: studentRoutes(requireChildSession({ sessions, expiry: parts.expiry })),
  });
}

/** The real parent-identity service, so the auto-create edge case runs against the table. */
function createParentIdentity(database: TestDatabase, ids: typeof uuidGenerator) {
  return createParentIdentityService({
    parents: createParentRepository({ db: database.db, ids }),
  });
}

/**
 * The student surface, gated for real and answered by a stub. What is under test here is who
 * gets through, not what the tutor says once they do.
 */
function studentRoutes(authorize: RequestHandler) {
  const echo: RequestHandler = (req, response) => {
    response.status(200).json({
      data: { studentId: req.studentId, protocolVersion: PROTOCOL_VERSION },
    });
  };
  return {
    authorize,
    arrival: echo,
    sessions: { create: echo, current: echo, end: echo, turn: echo },
  };
}

/** The cookie a login handed back, ready to be set on the next request. */
export function cookieFrom(response: request.Response): string {
  const header = response.headers['set-cookie']?.[0];
  if (header === undefined) throw new Error('no cookie was issued');
  return header.split(';')[0] ?? '';
}
