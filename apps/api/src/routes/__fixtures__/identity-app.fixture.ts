import { bandForGrade } from '@aria/shared';

import {
  createChildCredentialService,
  createChildSessionService,
  createParentSessionService,
  requireDeviceGrant,
  requireParentAuth,
} from '@/auth';
import type { ParentTokenVerifier } from '@/auth';
import {
  fakeChildCredentials,
  fakeChildSessions,
  plainHasher,
} from '@/auth/__fixtures__/identity.fixture';
import { createAuthControllers } from '@/controllers/auth.controller';
import { createDeviceControllers } from '@/controllers/device.controller';
import { createParentAccessControllers } from '@/controllers/parent-access.controller';
import { createParentControllers } from '@/controllers/parent.controller';
import { NotFoundError } from '@/errors';
import { sequentialUuids } from '@/lib/ids';
import { createLogger } from '@/lib/logger';
import { sequentialTokens } from '@/lib/tokens';
import { DEFAULT_STUDENT_SETTINGS } from '@/mappers/student.mapper';
import type { StudentRepository } from '@/repositories/student.repository';
import type { RouterDeps } from '@/routes';
import { createChildLoginService } from '@/services/auth/child-login.service';
import { createParentChildrenService } from '@/services/parent/children.service';
import { createConsentService } from '@/services/parent/consent.service';
import { createDeletionService } from '@/services/parent/deletion.service';
import { createDevicesService } from '@/services/parent/devices.service';
import type { Parent } from '@/types/parent';
import type { Student } from '@/types/student';

import {
  fakeConsentRecords,
  fakeDeletionLedger,
  fakeDeviceGrants,
  fakeParentSessions,
} from './parent-access.fixture';

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

/** The family behind `PARENT_TOKEN`, for the erasure path that has to name a provider user. */
export const PARENT: Parent = {
  id: PARENT_ID,
  email: PARENT_EMAIL,
  supabaseUserId: 'supabase-1',
  displayName: 'Parent',
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
};

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
        ? Promise.resolve({
            supabaseUserId: 'supabase-1',
            email: PARENT_EMAIL,
            sessionKey: 'supabase-session-1',
          })
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
    deleteById: (id, parentId) => {
      const student = rows.get(id);
      // The parent scope is part of the statement in the real repository, so the fake has to
      // enforce it too — otherwise a test could pass while the SQL leaked across families.
      if (student?.parentId !== parentId) return Promise.resolve(false);
      rows.delete(id);
      return Promise.resolve(true);
    },
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
  /** P0-28: what the provider was asked to erase, so a test can prove it was. */
  deletedProviderUsers: readonly string[];
}>;

export function buildIdentity(
  options: Readonly<{ consent?: Parameters<typeof createParentControllers>[0]['consent'] }> = {},
): IdentityFixture {
  let now = NOW;
  const clock = { now: () => now };
  const students = fakeStudents();
  const childSessions = fakeChildSessions();
  const credentials = createChildCredentialService({
    credentials: fakeChildCredentials({ studentId: SAM_ID }),
    hasher: plainHasher,
    clock,
  });
  const sessions = createChildSessionService({
    sessions: childSessions,
    clock,
    ids: sequentialUuids(),
    tokens: sequentialTokens(),
  });
  const access = buildAccess({ clock, childSessions });
  const children = createParentChildrenService({
    students,
    credentials,
    // P0-28: without this, `POST /parent/children` writes a row before anybody consented.
    consent: access.consent,
  });
  const login = createChildLoginService({ children, credentials, sessions, students });
  return {
    students,
    deletedProviderUsers: access.deletedProviderUsers,
    advance: (ms) => {
      now = new Date(now.getTime() + ms);
    },
    identity: routerDeps({ access, children, login, sessions, consent: options.consent }),
  };
}

function routerDeps(
  parts: Readonly<{
    access: ReturnType<typeof buildAccess>;
    children: ReturnType<typeof createParentChildrenService>;
    login: ReturnType<typeof createChildLoginService>;
    sessions: ReturnType<typeof createChildSessionService>;
    consent: Parameters<typeof createParentControllers>[0]['consent'];
  }>,
): NonNullable<RouterDeps['identity']> {
  const { access, children, login, sessions } = parts;
  const parentAuth = fakeParentAuth(access.parentSessions);

  return {
    auth: {
      parentAuth,
      controller: createAuthControllers({ login, sessions, secureCookies: false }),
    },
    parent: {
      parentAuth,
      controller: createParentControllers({
        children,
        sessions,
        ...(parts.consent === undefined ? {} : { consent: parts.consent }),
      }),
      access: createParentAccessControllers({
        consent: access.consent,
        devices: access.devices,
        deletion: access.deletion,
        sessions: access.parentSessions,
      }),
    },
    device: {
      deviceAuth: requireDeviceGrant({ devices: access.devices }),
      controller: createDeviceControllers({
        devices: access.devices,
        children,
        login,
        sessions,
        secureCookies: false,
      }),
    },
  };
}

/**
 * Device secrets long enough to be real ones.
 *
 * `sequentialTokens('device')` produces `device-1`, which the service rejects as malformed
 * before it ever reaches the store — so every device test would 401 for the wrong reason and
 * pass while proving nothing. A real secret is 32 random bytes; these are the same shape.
 */
function deviceTokens(): ReturnType<typeof sequentialTokens> {
  const inner = sequentialTokens('device');
  return { next: () => inner.next().padEnd(43, '0') };
}

/** The P0-28 services over in-memory repositories, and a provider that records what it erased. */
function buildAccess(input: {
  clock: Readonly<{ now(): Date }>;
  childSessions: ReturnType<typeof fakeChildSessions>;
}) {
  const { clock } = input;
  const shared = { clock, ids: sequentialUuids() };
  const deletedProviderUsers: string[] = [];

  const consent = createConsentService({ consents: fakeConsentRecords(), ...shared });
  const devices = createDevicesService({
    grants: fakeDeviceGrants(),
    sessions: input.childSessions,
    tokens: deviceTokens(),
    ...shared,
  });

  return {
    consent,
    devices,
    deletedProviderUsers,
    parentSessions: createParentSessionService({ sessions: fakeParentSessions(), ...shared }),
    deletion: createDeletionService({
      ledger: fakeDeletionLedger(),
      students: fakeStudents(),
      parents: {
        findById: (id) => Promise.resolve(id === PARENT_ID ? PARENT : null),
        deleteById: () => Promise.resolve(true),
      },
      consents: { withdrawAll: () => Promise.resolve(0) },
      directory: {
        deleteUser: (subject) => {
          deletedProviderUsers.push(subject);
          return Promise.resolve();
        },
      },
      logger: createLogger({ level: 'silent' }),
      ...shared,
    }),
  };
}

/** The real middleware over the fake verifier, so a missing header still 401s here. */
function fakeParentAuth(session: ReturnType<typeof createParentSessionService>): RequestHandler {
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
    session,
  });
}
