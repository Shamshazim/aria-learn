import { bandForGrade } from '@aria/shared';

import { createChildCredentialService, createChildSessionService, requireParentAuth } from '@/auth';
import type { ParentTokenVerifier } from '@/auth';
import {
  fakeChildCredentials,
  fakeChildSessions,
  plainHasher,
} from '@/auth/__fixtures__/identity.fixture';
import { createAuthControllers } from '@/controllers/auth.controller';
import { createParentControllers } from '@/controllers/parent.controller';
import { NotFoundError } from '@/errors';
import { sequentialUuids } from '@/lib/ids';
import { sequentialTokens } from '@/lib/tokens';
import type { StudentRepository } from '@/repositories/student.repository';
import type { RouterDeps } from '@/routes';
import { DEFAULT_STUDENT_SETTINGS } from '@/schemas/student-settings.schema';
import { createChildLoginService } from '@/services/auth/child-login.service';
import { createParentChildrenService } from '@/services/parent/children.service';
import type { Student } from '@/types/student';

import type { RequestHandler } from 'express';

/**
 * The identity stack, whole, with the database and Supabase replaced at their ports.
 *
 * Everything between the router and those two ports is the real thing: the same controllers,
 * the same services, the same cookie. A route test that faked a service would prove the route
 * exists; this proves a child can get in and a stranger cannot.
 */
export const PARENT_ID = '00000000-0000-4000-8000-0000000000a1';
export const OTHER_PARENT_ID = '00000000-0000-4000-8000-0000000000a2';
export const SAM_ID = '00000000-0000-4000-8000-000000000001';
export const PARENT_EMAIL = 'grown.up@example.test';
export const PARENT_TOKEN = 'valid-parent-token';
export const NOW = new Date('2026-08-25T10:00:00.000Z');

export const SAM: Student = {
  id: SAM_ID,
  parentId: PARENT_ID,
  displayName: 'Sam',
  grade: '4',
  band: 'middle',
  settings: DEFAULT_STUDENT_SETTINGS,
  createdAt: NOW,
};

/** Verifies exactly one token. Anything else fails the way a bad signature would. */
export function fakeVerifier(): ParentTokenVerifier {
  return {
    verify: (token) =>
      token === PARENT_TOKEN
        ? Promise.resolve({ supabaseUserId: 'supabase-1', email: PARENT_EMAIL })
        : Promise.reject(new Error('bad signature')),
  };
}

export function fakeStudents(seed: readonly Student[] = [SAM]): StudentRepository {
  const rows = new Map(seed.map((student) => [student.id, student]));
  let next = 100;
  const repository: StudentRepository = {
    withDb: () => repository,
    insert: (input) => {
      next += 1;
      const student: Student = {
        ...SAM,
        ...input,
        band: bandForGrade(input.grade),
        settings: input.settings ?? DEFAULT_STUDENT_SETTINGS,
        id: `00000000-0000-4000-8000-${String(next).padStart(12, '0')}`,
      };
      rows.set(student.id, student);
      return Promise.resolve(student);
    },
    findById: (id) => Promise.resolve(rows.get(id) ?? null),
    requireById: (id) => {
      const student = rows.get(id);
      if (student === undefined) throw new NotFoundError('student not found');
      return Promise.resolve(student);
    },
    listByParentId: (parentId) =>
      Promise.resolve([...rows.values()].filter((student) => student.parentId === parentId)),
    update: (id, changes) => {
      const current = rows.get(id);
      if (current === undefined) return Promise.resolve(null);
      const updated: Student = {
        ...current,
        ...changes,
        ...(changes.grade === undefined ? {} : { band: bandForGrade(changes.grade) }),
      };
      rows.set(id, updated);
      return Promise.resolve(updated);
    },
  };
  return repository;
}

export type IdentityFixture = Readonly<{
  identity: NonNullable<RouterDeps['identity']>;
  students: StudentRepository;
  advance(ms: number): void;
}>;

export function buildIdentity(
  options: Readonly<{ consent?: Parameters<typeof createParentControllers>[0]['consent'] }> = {},
): IdentityFixture {
  let now = NOW;
  const clock = { now: () => now };
  const students = fakeStudents();
  const credentials = createChildCredentialService({
    credentials: fakeChildCredentials({ studentId: SAM_ID }),
    hasher: plainHasher,
    clock,
  });
  const sessions = createChildSessionService({
    sessions: fakeChildSessions(),
    clock,
    ids: sequentialUuids(),
    tokens: sequentialTokens(),
  });
  const children = createParentChildrenService({ students, credentials });
  const login = createChildLoginService({ children, credentials, sessions, students });
  const parentAuth = fakeParentAuth();
  return {
    students,
    advance: (ms) => {
      now = new Date(now.getTime() + ms);
    },
    identity: {
      auth: {
        parentAuth,
        controller: createAuthControllers({ children, login, sessions, secureCookies: false }),
      },
      parent: {
        parentAuth,
        controller: createParentControllers({
          children,
          ...(options.consent === undefined ? {} : { consent: options.consent }),
        }),
      },
    },
  };
}

/** The real middleware over the fake verifier, so a missing header still 401s here. */
function fakeParentAuth(): RequestHandler {
  return requireParentAuth({
    verifier: fakeVerifier(),
    identity: {
      resolve: (token) =>
        Promise.resolve({
          id: PARENT_ID,
          supabaseUserId: token.supabaseUserId,
          email: token.email,
        }),
    },
  });
}
