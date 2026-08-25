import { UnauthenticatedError } from '@/errors';
import { SESSION_LIFETIMES } from '@/identity';
import type { AdultIdentityProvider } from '@/identity';
import type { Clock } from '@/lib/clock';
import type { AdultIdentityRepository } from '@/repositories/adult-identity.repository';
import type { AdultSessionRepository } from '@/repositories/adult-session.repository';
import type { AdultActor, AdultIdentity, AdultRole } from '@/types/identity';

import type { AdultProvisioning } from './adult-provisioning';

/**
 * Turning a provider token into an Aria adult, on every request.
 *
 * Three things have to be true, and all three are checked here rather than spread across
 * middleware: the token verifies, Aria still has an identity row for its subject, and Aria's
 * own session for it is live. The second is what rejects a parent Aria has deleted whose JWT
 * has not expired yet — the token is perfectly valid and there is simply nobody to be.
 *
 * The third is why revocation is immediate: a revoked row fails the check on the next
 * request, without waiting for a token to age out or asking the vendor anything.
 */
export type AdultSignIn = Readonly<{
  accessToken: string;
  /** The FTC age/role gate. A visitor who is not an adult leaves no row behind. */
  attestation: Readonly<{ isAdult: boolean; role: AdultRole; displayName?: string | undefined }>;
}>;

export type AuthenticatedAdult = Readonly<{
  actor: AdultActor;
  identity: AdultIdentity;
}>;

export type AdultAuthService = Readonly<{
  signIn(input: AdultSignIn): Promise<AuthenticatedAdult>;
  /**
   * `fresh` asks the vendor whether the session is still live — a network round trip, and the
   * reason it is a parameter rather than the default. P0-26 requires it for sensitive parent
   * actions and nowhere else.
   */
  authenticate(
    accessToken: string,
    options?: Readonly<{ fresh?: boolean }>,
  ): Promise<AuthenticatedAdult>;
  signOut(sessionId: string): Promise<void>;
}>;

export type AdultAuthServiceDeps = Readonly<{
  provider: AdultIdentityProvider;
  identities: AdultIdentityRepository;
  sessions: AdultSessionRepository;
  provisioning: AdultProvisioning;
  clock: Clock;
}>;

export function createAdultAuthService(deps: AdultAuthServiceDeps): AdultAuthService {
  return {
    signIn: (input) => signIn(deps, input),
    authenticate: (accessToken, options = {}) =>
      authenticate(deps, accessToken, options.fresh === true),
    signOut: async (sessionId) => {
      await deps.sessions.revoke(sessionId, deps.clock.now());
    },
  };
}

async function signIn(deps: AdultAuthServiceDeps, input: AdultSignIn): Promise<AuthenticatedAdult> {
  const { provider, identities } = deps;
  const verified = await provider.verifyAccessToken(input.accessToken);
  const existing = await identities.findBySubject(provider.name, verified.subject);

  if (existing !== null) return openSession(deps, existing, verified.sessionId);

  // Before the first row, not after: a visitor who says they are not an adult must leave no
  // account and no persistent identifier behind (rewrite.md §6).
  if (!input.attestation.isAdult) {
    throw new UnauthenticatedError('age gate refused: visitor did not attest to being an adult');
  }

  const identity = await deps.provisioning({
    provider: provider.name,
    subject: verified.subject,
    email: verified.email,
    role: input.attestation.role,
    ...(input.attestation.displayName === undefined
      ? {}
      : { displayName: input.attestation.displayName }),
    at: deps.clock.now(),
  });

  return openSession(deps, identity, verified.sessionId);
}

async function authenticate(
  deps: AdultAuthServiceDeps,
  accessToken: string,
  fresh: boolean,
): Promise<AuthenticatedAdult> {
  const { provider, identities, sessions, clock } = deps;
  const verified = await provider.verifyAccessToken(accessToken);

  const identity = await identities.findBySubject(provider.name, verified.subject);
  if (identity === null) {
    throw new UnauthenticatedError('provider token carries a subject Aria has no identity for');
  }

  const session = await sessions.findByProviderSessionId(verified.sessionId);
  const now = clock.now();
  if (session === null || !isLive(session, now)) {
    throw new UnauthenticatedError(`adult session ${verified.sessionId} is revoked or expired`);
  }

  if (fresh) await provider.assertLiveSession(accessToken);

  await sessions.touch(session.id, now);
  return { actor: toActor(identity, session.id, fresh), identity };
}

async function openSession(
  deps: AdultAuthServiceDeps,
  identity: AdultIdentity,
  providerSessionId: string,
): Promise<AuthenticatedAdult> {
  const now = deps.clock.now();
  const session = await deps.sessions.upsert({
    adultId: identity.id,
    providerSessionId,
    at: now,
    absoluteExpiresAt: new Date(now.getTime() + SESSION_LIFETIMES.adultAbsoluteMs),
  });

  return { actor: toActor(identity, session.id, false), identity };
}

/**
 * Both windows, checked together. The absolute deadline is stored; the idle one is measured
 * from `lastSeenAt`, so raising or lowering the policy takes effect on existing sessions
 * instead of only on new ones.
 */
function isLive(
  session: Readonly<{ revokedAt: Date | null; lastSeenAt: Date; absoluteExpiresAt: Date }>,
  now: Date,
): boolean {
  if (session.revokedAt !== null) return false;
  if (session.absoluteExpiresAt.getTime() <= now.getTime()) return false;
  return now.getTime() - session.lastSeenAt.getTime() < SESSION_LIFETIMES.adultIdleMs;
}

function toActor(identity: AdultIdentity, sessionId: string, freshlyVerified: boolean): AdultActor {
  return {
    adultId: identity.id,
    role: identity.role,
    parentId: identity.parentId,
    sessionId,
    providerSubject: identity.providerSubject,
    freshlyVerified,
  };
}
