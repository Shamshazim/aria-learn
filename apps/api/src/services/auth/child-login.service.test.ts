import { describe, expect, it } from 'vitest';

import { createChildCredentialService, createChildSessionService } from '@/auth';
import {
  fakeChildCredentials,
  fakeChildSessions,
  plainHasher,
} from '@/auth/__fixtures__/identity.fixture';
import { sequentialUuids } from '@/lib/ids';
import { sequentialTokens } from '@/lib/tokens';
import { fakeStudents, NOW, PARENT_ID, SAM_ID } from '@/routes/__fixtures__/identity-app.fixture';
import { createChildLoginService } from '@/services/auth/child-login.service';
import { createParentChildrenService } from '@/services/parent/children.service';

function build() {
  const clock = { now: () => NOW };
  const students = fakeStudents();
  const credentials = createChildCredentialService({
    credentials: fakeChildCredentials({ studentId: SAM_ID, familyDevice: true }),
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
  return {
    sessions,
    service: createChildLoginService({ children, credentials, sessions, students }),
  };
}

const login = (service: ReturnType<typeof build>['service']) =>
  service.login({
    parentId: PARENT_ID,
    childId: SAM_ID,
    attempt: {},
    deviceLabel: 'kitchen tablet',
  });

describe('a child signing in', () => {
  it('binds the session to the child and the parent who is signed in here', async () => {
    const { service } = build();

    const result = await login(service);

    expect(result.issued.session).toMatchObject({
      studentId: SAM_ID,
      parentId: PARENT_ID,
      deviceLabel: 'kitchen tablet',
    });
    expect(result.child.firstName).toBe('Sam');
  });

  /** A tablet somebody walked away from must not keep working after the next sign-in. */
  it('ends the previous session for that child', async () => {
    const { service, sessions } = build();
    const first = await login(service);

    await login(service);

    await expect(sessions.check(first.issued.token)).resolves.toEqual({ status: 'unknown' });
  });

  it('refuses a child who belongs to somebody else', async () => {
    const { service } = build();

    await expect(
      service.login({
        parentId: '00000000-0000-4000-8000-0000000000a2',
        childId: SAM_ID,
        attempt: {},
        deviceLabel: null,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });

  it('gives nothing back for a refresh of a session that has been signed out', async () => {
    const { service } = build();
    const { issued } = await login(service);

    await service.logout(issued.token);

    await expect(service.refresh(issued.token)).resolves.toBeNull();
  });
});
