import { PICTURE_SEQUENCE_LENGTH, type ChildPicture } from '@aria/shared';

import type { Clock } from '@/lib/clock';
import type { ChildCredentialRepository } from '@/repositories/child-credential.repository';
import type { ChildCredential, ChildLoginFailure, ChildLoginMethod } from '@/types/auth';

import type { SecretHasher } from './secret-hasher';

/**
 * What a child has to do to get in, and what happens when they get it wrong (P2H-12).
 *
 * Five wrong tries and the door closes for fifteen minutes. A four-digit PIN has ten thousand
 * possibilities and a picture sequence has a hundred and twenty, so neither is strong enough
 * to be guessed at slowly — the lockout is the whole defence, and it is counted server-side
 * against the credential row so a child cannot reset it by reloading the page.
 *
 * A locked child is never shown a countdown. The screen says "Ask a grown-up", which is both
 * true and the only useful thing to tell a six-year-old.
 */
export const MAX_ATTEMPTS = 5;
export const LOCK_MS = 15 * 60 * 1_000;

export type ChildLoginAttempt = Readonly<{
  pin?: string;
  pictureSequence?: readonly ChildPicture[];
}>;

export type ChildLoginOutcome =
  Readonly<{ ok: true }> | Readonly<{ ok: false; reason: ChildLoginFailure }>;

export type ChildCredentialService = Readonly<{
  /** How this child signs in, for the picker. `none` means a grown-up has not set it up. */
  methodFor(studentId: string): Promise<ChildLoginMethod>;
  attempt(studentId: string, attempt: ChildLoginAttempt): Promise<ChildLoginOutcome>;
  setPin(studentId: string, pin: string | null): Promise<void>;
  setPictureSequence(studentId: string, sequence: readonly ChildPicture[] | null): Promise<void>;
  setFamilyDevice(studentId: string, familyDevice: boolean): Promise<void>;
}>;

export function createChildCredentialService(deps: {
  credentials: ChildCredentialRepository;
  hasher: SecretHasher;
  clock: Clock;
}): ChildCredentialService {
  return {
    methodFor: async (studentId) => methodOf(await deps.credentials.find(studentId)),
    attempt: (studentId, attempt) => tryLogin(deps, studentId, attempt),

    setPin: async (studentId, pin) => {
      await deps.credentials.upsert({
        studentId,
        pinHash: pin === null ? null : await deps.hasher.hash(pin),
        at: deps.clock.now(),
      });
    },

    setPictureSequence: async (studentId, sequence) => {
      await deps.credentials.upsert({
        studentId,
        pictureHash: sequence === null ? null : await deps.hasher.hash(joinSequence(sequence)),
        at: deps.clock.now(),
      });
    },

    setFamilyDevice: async (studentId, familyDevice) => {
      await deps.credentials.upsert({ studentId, familyDevice, at: deps.clock.now() });
    },
  };
}

type Deps = Parameters<typeof createChildCredentialService>[0];

/**
 * A family device wins over a PIN that is also set.
 *
 * The shared-tablet case is the one the parent asked for most recently, and a device they
 * marked as the family's is a statement that the picker alone is enough on it. The hashes stay
 * where they are, so unmarking the device puts the PIN straight back.
 */
function methodOf(credential: ChildCredential | null): ChildLoginMethod {
  if (credential === null) return 'none';
  if (credential.familyDevice) return 'family-device';
  if (credential.pinHash !== null) return 'pin';
  if (credential.pictureHash !== null) return 'picture';
  return 'none';
}

async function tryLogin(
  deps: Deps,
  studentId: string,
  attempt: ChildLoginAttempt,
): Promise<ChildLoginOutcome> {
  const credential = await deps.credentials.find(studentId);
  if (credential === null) return { ok: false, reason: 'not-configured' };
  const now = deps.clock.now();
  if (credential.lockedUntil !== null && credential.lockedUntil > now) {
    return { ok: false, reason: 'locked' };
  }
  if (credential.familyDevice) return { ok: true };

  const matched = await matches(deps, credential, attempt);
  if (matched === null) return { ok: false, reason: 'not-configured' };
  if (matched) {
    await deps.credentials.clearFailures(studentId, now);
    return { ok: true };
  }
  return recordFailure(deps, credential, now);
}

/**
 * Null means this child has no method of the kind offered — a distinct answer from "wrong",
 * because it is not the child's mistake and must not count towards their lockout.
 */
async function matches(
  deps: Deps,
  credential: ChildCredential,
  attempt: ChildLoginAttempt,
): Promise<boolean | null> {
  if (attempt.pin !== undefined && credential.pinHash !== null) {
    return deps.hasher.verify(credential.pinHash, attempt.pin);
  }
  if (
    attempt.pictureSequence?.length === PICTURE_SEQUENCE_LENGTH &&
    credential.pictureHash !== null
  ) {
    return deps.hasher.verify(credential.pictureHash, joinSequence(attempt.pictureSequence));
  }
  return null;
}

async function recordFailure(
  deps: Deps,
  credential: ChildCredential,
  now: Date,
): Promise<ChildLoginOutcome> {
  const attempts = credential.failedAttempts + 1;
  const lockedUntil = attempts >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCK_MS) : null;
  await deps.credentials.recordFailure(credential.studentId, now, lockedUntil);
  return { ok: false, reason: lockedUntil === null ? 'wrong' : 'locked' };
}

/** Order matters: the sequence is a password, not a set. */
function joinSequence(sequence: readonly ChildPicture[]): string {
  return sequence.join('-');
}
