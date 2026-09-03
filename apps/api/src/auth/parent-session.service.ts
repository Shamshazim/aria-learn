import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { ParentSessionRepository } from '@/repositories/parent-session.repository';
import type { ParentSessionRecord } from '@/types/parent-access';

/**
 * A parent's session, on our side of the token (P0-28).
 *
 * P2H-12 verifies the JWT and trusts it until it expires, which is the right check and half
 * an answer: a token we did not mint is a token we cannot take back. So every verified
 * request also touches a row, and the row is what decides whether the parent is still signed
 * in. The vendor says *who*; we say *for how long*, and we can stop saying it.
 *
 * Two deadlines, both ours and both server-side. Thirty days absolute, so a session cannot
 * outlive the month it began in however often the vendor refreshes its token. Seven days
 * idle, which is long for a parent app and short enough that an abandoned laptop stops being
 * a way into a family's account.
 */
export const PARENT_SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1_000;
export const PARENT_SESSION_IDLE_MS = 7 * 24 * 60 * 60 * 1_000;

/** As with a child's session, one write a minute is accurate enough for a week-long window. */
const TOUCH_INTERVAL_MS = 60 * 1_000;

export type ParentSessionCheck =
  | Readonly<{ status: 'active'; session: ParentSessionRecord }>
  /** Revoked, idle, or past its absolute deadline. The caller turns all three into one 401. */
  | Readonly<{ status: 'ended'; reason: 'revoked' | 'idle' | 'expired' }>;

export type ParentSessionService = Readonly<{
  /** Called on every authenticated parent request, after the JWT checks out. */
  check(input: Readonly<{ parentId: string; sessionKey: string }>): Promise<ParentSessionCheck>;
  /** Sign out everywhere. Returns how many sessions ended. */
  endAllForParent(parentId: string): Promise<number>;
}>;

export function createParentSessionService(deps: {
  sessions: ParentSessionRepository;
  clock: Clock;
  ids: IdGenerator;
}): ParentSessionService {
  return {
    check: (input) => check(deps, input),
    endAllForParent: (parentId) => deps.sessions.revokeAllForParent(parentId, deps.clock.now()),
  };
}

type Deps = Parameters<typeof createParentSessionService>[0];

async function check(
  deps: Deps,
  input: Readonly<{ parentId: string; sessionKey: string }>,
): Promise<ParentSessionCheck> {
  const now = deps.clock.now();

  // Upsert, not find-then-insert: the first request of a new sign-in creates the row, and two
  // tabs making that request at once must not race for the unique index.
  const session = await deps.sessions.upsert({
    id: deps.ids.next(),
    parentId: input.parentId,
    providerSessionId: input.sessionKey,
    at: now,
    expiresAt: new Date(now.getTime() + PARENT_SESSION_MAX_MS),
  });

  const ended = endedReason(session, now);
  if (ended !== null) return { status: 'ended', reason: ended };

  if (now.getTime() - session.lastSeenAt.getTime() >= TOUCH_INTERVAL_MS) {
    await deps.sessions.touch(session.id, now);
  }

  return { status: 'active', session };
}

/**
 * Revoked first. A parent who pressed "sign out everywhere" should see that answer rather
 * than "idle", because it is the one that tells them the button worked.
 */
function endedReason(
  session: ParentSessionRecord,
  now: Date,
): 'revoked' | 'idle' | 'expired' | null {
  if (session.revokedAt !== null) return 'revoked';
  if (session.expiresAt.getTime() <= now.getTime()) return 'expired';
  if (now.getTime() - session.lastSeenAt.getTime() > PARENT_SESSION_IDLE_MS) return 'idle';
  return null;
}
