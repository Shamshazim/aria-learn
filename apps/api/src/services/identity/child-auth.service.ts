import type { PictureSecret } from '@aria/shared';

import { TooManyAttemptsError, UnauthenticatedError } from '@/errors';
import {
  PICTURE_SECRET_THROTTLE,
  SECRET_KINDS,
  SESSION_LIFETIMES,
  hashSecret,
  pictureSecretMatches,
} from '@/identity';
import type { SecretGenerator } from '@/identity';
import type { Clock } from '@/lib/clock';
import type { ChildSessionRepository } from '@/repositories/child-session.repository';
import type { DeviceGrantRepository } from '@/repositories/device-grant.repository';
import type { StudentCredentialRepository } from '@/repositories/student-credential.repository';
import type {
  ChildActor,
  ChildProfileSummary,
  DeviceGrant,
  IssuedChildSession,
} from '@/types/device-access';

/**
 * How a five-year-old signs in.
 *
 * Three steps, none of which involves reading: the device is already authorised, the child
 * taps their own picture, and then taps four more. Everything this service refuses, it refuses
 * the same way — one `UnauthenticatedError` whose safe message says nothing about which step
 * failed, because "wrong picture" and "not your device" are the same answer to a stranger.
 *
 * Four pictures is 65,536 combinations, which is small on purpose. The throttle below is what
 * makes that safe online: five wrong attempts lock the profile for fifteen minutes, counted
 * atomically on the student row so two devices guessing at once do not each get five.
 */
export type OpenChildSessionInput = Readonly<{
  deviceSecret: string;
  studentId: string;
  pictureSecret: PictureSecret;
}>;

export type ChildAuthService = Readonly<{
  /** The picker. A picture and a nickname for the children this device may open, and no more. */
  listProfiles(deviceSecret: string): Promise<readonly ChildProfileSummary[]>;
  open(input: OpenChildSessionInput): Promise<IssuedChildSession>;
  /** Every child request. Resolves the opaque token to the one student it may act as. */
  authenticate(token: string): Promise<ChildActor>;
  end(sessionId: string): Promise<void>;
}>;

export type ChildAuthServiceDeps = Readonly<{
  grants: DeviceGrantRepository;
  credentials: StudentCredentialRepository;
  sessions: ChildSessionRepository;
  secrets: SecretGenerator;
  clock: Clock;
}>;

/** One message for every refusal on the sign-in path. See the note above. */
function refused(reason: string): UnauthenticatedError {
  return new UnauthenticatedError(`child sign-in refused — ${reason}`);
}

export function createChildAuthService(deps: ChildAuthServiceDeps): ChildAuthService {
  return {
    listProfiles: (deviceSecret) => listProfiles(deps, deviceSecret),
    open: (input) => open(deps, input),
    authenticate: (token) => authenticate(deps, token),
    end: async (sessionId) => {
      await deps.sessions.revoke(sessionId, deps.clock.now());
    },
  };
}

async function listProfiles(
  deps: ChildAuthServiceDeps,
  deviceSecret: string,
): Promise<readonly ChildProfileSummary[]> {
  const grant = await requireGrant(deps, deviceSecret);
  await deps.grants.touch(grant.id, deps.clock.now());
  return deps.grants.listProfiles(grant.id);
}

async function open(
  deps: ChildAuthServiceDeps,
  input: OpenChildSessionInput,
): Promise<IssuedChildSession> {
  const { credentials, sessions, secrets, clock } = deps;
  const grant = await requireGrant(deps, input.deviceSecret);
  const credential = await requireUnlockedCredential(deps, input.studentId, grant.id);

  if (!(await pictureSecretMatches(input.pictureSecret, credential.secretHash))) {
    throw await recordWrongSecret(deps, input.studentId);
  }

  await credentials.clearFailures(input.studentId);

  // Switching profiles locks the previous one (rewrite.md §6): a child who hands the tablet to
  // a sibling must not leave their own session open behind them.
  const now = clock.now();
  await sessions.revokeAllForGrant(grant.id, now);

  const token = secrets.issue(SECRET_KINDS.childSession);
  const session = await sessions.insert({
    grantId: grant.id,
    studentId: input.studentId,
    tokenHash: hashSecret(token),
    at: now,
    absoluteExpiresAt: new Date(now.getTime() + SESSION_LIFETIMES.childAbsoluteMs),
  });

  return { session, token };
}

async function authenticate(deps: ChildAuthServiceDeps, token: string): Promise<ChildActor> {
  const now = deps.clock.now();
  const live = await deps.sessions.findLiveByTokenHash(
    hashSecret(token),
    now,
    SESSION_LIFETIMES.childIdleMs,
  );
  if (live === null) throw refused('child session is unknown, revoked or expired');

  await deps.sessions.touch(live.session.id, now);
  return {
    studentId: live.session.studentId,
    sessionId: live.session.id,
    grantId: live.session.grantId,
  };
}

async function requireGrant(
  deps: ChildAuthServiceDeps,
  deviceSecret: string,
): Promise<DeviceGrant> {
  const grant = await deps.grants.findActiveBySecretHash(
    hashSecret(deviceSecret),
    deps.clock.now(),
  );
  if (grant === null) throw refused('device is not authorised');
  return grant;
}

/** The credential, only once the device may open it and the profile is not locked out. */
async function requireUnlockedCredential(
  deps: ChildAuthServiceDeps,
  studentId: string,
  grantId: string,
): Promise<{ secretHash: string }> {
  if (!(await deps.grants.permits(grantId, studentId))) {
    throw refused(`device ${grantId} is not scoped to student ${studentId}`);
  }

  const credential = await deps.credentials.find(studentId);
  if (credential?.secretHash == null) {
    throw refused(`student ${studentId} has no picture secret set`);
  }

  const now = deps.clock.now();
  // Parenthesised: `??` binds looser than `>`, so the comparison has to be the outer one.
  if ((credential.lockedUntil?.getTime() ?? 0) > now.getTime()) {
    throw locked(credential.lockedUntil ?? now, now);
  }

  return { secretHash: credential.secretHash };
}

/** Counts the attempt, and returns the error to throw — a lockout if this one crossed the line. */
async function recordWrongSecret(
  deps: ChildAuthServiceDeps,
  studentId: string,
): Promise<UnauthenticatedError | TooManyAttemptsError> {
  const now = deps.clock.now();
  const { lockedUntil } = await deps.credentials.recordFailure({
    studentId,
    at: now,
    maxAttempts: PICTURE_SECRET_THROTTLE.maxAttempts,
    lockoutMs: PICTURE_SECRET_THROTTLE.lockoutMs,
  });

  return lockedUntil === null ? refused('picture secret does not match') : locked(lockedUntil, now);
}

/**
 * A locked profile is told how long to wait, because the interface has to say something a
 * child can act on — and "try again" with no number is what makes them keep trying.
 */
function locked(until: Date, now: Date): TooManyAttemptsError {
  const seconds = Math.max(1, Math.ceil((until.getTime() - now.getTime()) / 1000));
  return new TooManyAttemptsError(`picture secret locked until ${until.toISOString()}`, seconds);
}
