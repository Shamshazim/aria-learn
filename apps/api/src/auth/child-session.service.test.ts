import { describe, expect, it } from 'vitest';

import { sequentialUuids } from '@/lib/ids';
import { sequentialTokens } from '@/lib/tokens';

import { fakeChildSessions } from './__fixtures__/identity.fixture';
import {
  CHILD_SESSION_IDLE_MS,
  CHILD_SESSION_MAX_MS,
  createChildSessionService,
} from './child-session.service';

const START = new Date('2026-08-25T09:00:00.000Z');

function build(): Readonly<{
  service: ReturnType<typeof createChildSessionService>;
  sessions: ReturnType<typeof fakeChildSessions>;
  advance(ms: number): void;
}> {
  const sessions = fakeChildSessions();
  let now = START;
  const service = createChildSessionService({
    sessions,
    clock: { now: () => now },
    ids: sequentialUuids(),
    tokens: sequentialTokens(),
  });
  return {
    service,
    sessions,
    advance: (ms) => {
      now = new Date(now.getTime() + ms);
    },
  };
}

const issue = (service: ReturnType<typeof createChildSessionService>) =>
  service.issue({ studentId: 'student-1', parentId: 'parent-1', deviceLabel: 'kitchen tablet' });

describe('child sessions', () => {
  it('issues a cookie that names the session and proves the holder', async () => {
    const { service } = build();
    const { session, token } = await issue(service);

    expect(token.startsWith(`${session.id}.`)).toBe(true);
    expect(session.expiresAt.getTime()).toBe(START.getTime() + CHILD_SESSION_MAX_MS);
    await expect(service.check(token)).resolves.toMatchObject({ status: 'active' });
  });

  /** The token is the secret; the table only ever sees what it hashes to. */
  it('never stores the secret it handed out', async () => {
    const { service, sessions } = build();
    const { token } = await issue(service);
    const secret = token.slice(token.indexOf('.') + 1);

    const stored = [...sessions.rows.values()].map((row) => row.tokenHash);
    expect(stored).not.toContain(secret);
    expect(stored[0]).toMatch(/^[0-9a-f]{64}$/u);
  });

  it('refuses a cookie whose id does not belong to its secret', async () => {
    const { service } = build();
    const { token } = await issue(service);
    const secret = token.slice(token.indexOf('.') + 1);

    await expect(service.check(`someone-elses-id.${secret}`)).resolves.toEqual({
      status: 'unknown',
    });
  });

  it('refuses a cookie that was never issued, and one with no secret at all', async () => {
    const { service } = build();

    await expect(service.check('made.up')).resolves.toEqual({ status: 'unknown' });
    await expect(service.check('nodot')).resolves.toEqual({ status: 'unknown' });
  });

  /** P2H-12: half an hour of silence, measured server-side, ends it. */
  it('expires a session nobody has used for thirty minutes, and revokes it on the way', async () => {
    const { service, advance } = build();
    const { token } = await issue(service);

    advance(CHILD_SESSION_IDLE_MS + 1_000);
    await expect(service.check(token)).resolves.toMatchObject({ status: 'idle' });
    // Already revoked: a second look is not a second chance.
    await expect(service.check(token)).resolves.toEqual({ status: 'unknown' });
  });

  it('keeps a session alive while it is being used', async () => {
    const { service, advance } = build();
    const { token } = await issue(service);

    for (let index = 0; index < 4; index += 1) {
      advance(CHILD_SESSION_IDLE_MS - 60_000);
      await expect(service.check(token)).resolves.toMatchObject({ status: 'active' });
    }
  });

  it('ends at the absolute deadline however busy the child was', async () => {
    const { service, advance } = build();
    const { token } = await issue(service);

    for (let elapsed = 0; elapsed < CHILD_SESSION_MAX_MS; elapsed += 60_000) {
      advance(60_000);
      await service.check(token);
    }
    await expect(service.check(token)).resolves.toEqual({ status: 'unknown' });
  });

  it('rotates to a new secret and leaves the old one dead', async () => {
    const { service, advance } = build();
    const first = await issue(service);

    advance(120_000);
    const rotated = await service.rotate(first.token);
    if (rotated === null) throw new Error('rotation should have been possible');

    expect(rotated.token).not.toBe(first.token);
    expect(rotated.session.id).toBe(first.session.id);
    await expect(service.check(rotated.token)).resolves.toMatchObject({ status: 'active' });
    await expect(service.check(first.token)).resolves.toEqual({ status: 'unknown' });
  });

  it('cannot rotate a session that has already gone idle', async () => {
    const { service, advance } = build();
    const { token } = await issue(service);

    advance(CHILD_SESSION_IDLE_MS + 1);
    await expect(service.rotate(token)).resolves.toBeNull();
  });

  it('ends one session on logout and every session when a parent asks', async () => {
    const { service } = build();
    const kitchen = await issue(service);
    const bedroom = await issue(service);

    await service.end(kitchen.token);
    await expect(service.check(kitchen.token)).resolves.toEqual({ status: 'unknown' });
    await expect(service.check(bedroom.token)).resolves.toMatchObject({ status: 'active' });

    await expect(service.endAllForParent('parent-1')).resolves.toHaveLength(1);
    await expect(service.check(bedroom.token)).resolves.toEqual({ status: 'unknown' });
  });

  it('reports the idle deadline so a client can warn before it arrives', async () => {
    const { service } = build();
    const { session } = await issue(service);

    expect(service.idleDeadline(session).getTime()).toBe(START.getTime() + CHILD_SESSION_IDLE_MS);
  });
});
