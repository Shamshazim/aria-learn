import { createHash, timingSafeEqual } from 'node:crypto';

import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { TokenGenerator } from '@/lib/tokens';
import type { ChildSessionRepository } from '@/repositories/child-session.repository';
import type { ChildSessionRecord, IssuedChildSession } from '@/types/auth';

import { packCookie, unpackCookie } from './child-session.cookie';

/**
 * Issuing, checking and ending a child's session (P2H-12).
 *
 * Two deadlines, both server-side. The absolute one is twelve hours, so a session cannot
 * outlive the day it started in; the idle one is thirty minutes, so a tablet left on the sofa
 * stops being a way into a child's account. A device with a wrong clock cannot argue with
 * either, because neither is read from the token.
 */
export const CHILD_SESSION_MAX_MS = 12 * 60 * 60 * 1_000;
export const CHILD_SESSION_IDLE_MS = 30 * 60 * 1_000;

/**
 * Idle expiry is measured in minutes, so the last-seen stamp does not need to be written on
 * every turn of a conversation. One write a minute per child is enough to be accurate and
 * little enough not to put a row update in front of every question a child answers.
 */
const TOUCH_INTERVAL_MS = 60 * 1_000;

export type ChildSessionCheck =
  | Readonly<{ status: 'active'; session: ChildSessionRecord }>
  /** It was a real session until nobody used it for half an hour. Already revoked. */
  | Readonly<{ status: 'idle'; session: ChildSessionRecord }>
  | Readonly<{ status: 'unknown' }>;

export type ChildSessionService = Readonly<{
  issue(
    input: Readonly<{ studentId: string; parentId: string; deviceLabel: string | null }>,
  ): Promise<IssuedChildSession>;
  check(cookie: string): Promise<ChildSessionCheck>;
  /** A new secret for the same session, and the idle clock back to zero. */
  rotate(cookie: string): Promise<IssuedChildSession | null>;
  end(cookie: string): Promise<void>;
  /** A parent signing every device out. Returns the sessions that were live. */
  endAllForParent(parentId: string): Promise<readonly ChildSessionRecord[]>;
  endAllForStudent(studentId: string): Promise<readonly ChildSessionRecord[]>;
  /** When this session goes idle, for a client that wants to warn before it happens. */
  idleDeadline(session: ChildSessionRecord): Date;
}>;

export function createChildSessionService(deps: {
  sessions: ChildSessionRepository;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
}): ChildSessionService {
  return {
    issue: (input) => issue(deps, input),
    check: (cookie) => check(deps, cookie),
    rotate: (cookie) => rotate(deps, cookie),
    end: (cookie) => end(deps, cookie),
    endAllForParent: (parentId) => deps.sessions.revokeAllForParent(parentId, deps.clock.now()),
    endAllForStudent: (studentId) => deps.sessions.revokeAllForStudent(studentId, deps.clock.now()),
    idleDeadline: (session) => new Date(session.lastSeenAt.getTime() + CHILD_SESSION_IDLE_MS),
  };
}

type Deps = Parameters<typeof createChildSessionService>[0];

async function issue(
  deps: Deps,
  input: Readonly<{ studentId: string; parentId: string; deviceLabel: string | null }>,
): Promise<IssuedChildSession> {
  const issuedAt = deps.clock.now();
  const secret = deps.tokens.next();
  const id = deps.ids.next();
  const session = await deps.sessions.insert({
    id,
    studentId: input.studentId,
    parentId: input.parentId,
    tokenHash: hash(secret),
    issuedAt,
    expiresAt: new Date(issuedAt.getTime() + CHILD_SESSION_MAX_MS),
    deviceLabel: input.deviceLabel,
  });
  return { session, token: packCookie(id, secret) };
}

async function check(deps: Deps, cookie: string): Promise<ChildSessionCheck> {
  const now = deps.clock.now();
  const parts = unpackCookie(cookie);
  if (parts === null) return { status: 'unknown' };
  const session = await deps.sessions.findLiveByTokenHash(hash(parts.secret), now);
  // The id in the cookie is checked against the row the *secret* found, not used to find it:
  // a lookup by id would let a wrong secret reveal that a session id exists.
  if (session === null || !sameId(session.id, parts.id)) return { status: 'unknown' };
  if (now.getTime() - session.lastSeenAt.getTime() > CHILD_SESSION_IDLE_MS) {
    await deps.sessions.revoke(session.id, now);
    return { status: 'idle', session };
  }
  if (now.getTime() - session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
    await deps.sessions.touch(session.id, now);
  }
  return { status: 'active', session };
}

async function rotate(deps: Deps, cookie: string): Promise<IssuedChildSession | null> {
  const current = await check(deps, cookie);
  if (current.status !== 'active') return null;
  const secret = deps.tokens.next();
  const session = await deps.sessions.rotate(current.session.id, hash(secret), deps.clock.now());
  return session === null ? null : { session, token: packCookie(session.id, secret) };
}

async function end(deps: Deps, cookie: string): Promise<void> {
  const parts = unpackCookie(cookie);
  if (parts === null) return;
  const session = await deps.sessions.findLiveByTokenHash(hash(parts.secret), deps.clock.now());
  if (session === null) return;
  await deps.sessions.revoke(session.id, deps.clock.now());
}

/** SHA-256 and not argon2: this is a 256-bit random secret, not something a person chose. */
function hash(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

/** Constant time, so a mismatched id cannot be found one character at a time. */
function sameId(left: string, right: string): boolean {
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}
