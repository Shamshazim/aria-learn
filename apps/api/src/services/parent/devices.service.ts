import { createHash } from 'node:crypto';

import { ForbiddenError, NotFoundError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { TokenGenerator } from '@/lib/tokens';
import type { ChildSessionRepository } from '@/repositories/child-session.repository';
import type { DeviceGrantRepository } from '@/repositories/device-grant.repository';
import type { DeviceGrant, DeviceGrantSummary, IssuedDeviceGrant } from '@/types/parent-access';

/**
 * Trusting a tablet without signing a parent in on it (P0-28).
 *
 * P2H-12's arrangement is that a child signs in where their parent's JWT already is. That
 * works, and it means a child's tablet carries a parent's whole account — their email, their
 * billing, every sibling. A grant is the other way round: the parent authorises the device
 * once from their own phone, and the tablet ends up holding a secret that can do exactly one
 * thing, for exactly the children named on it.
 *
 * The secret is returned exactly once, from `create`. There is no endpoint that reads it back
 * and no column that could: a parent who loses it revokes the grant and makes another.
 */
export type DevicesService = Readonly<{
  create(
    input: Readonly<{ parentId: string; label: string; studentIds: readonly string[] }>,
  ): Promise<IssuedDeviceGrant>;
  list(parentId: string): Promise<readonly DeviceGrantSummary[]>;
  /** Revoking also ends the child sessions the device is holding. See below. */
  revoke(parentId: string, grantId: string): Promise<DeviceGrant>;
  /**
   * The grant behind a device secret, or null. Says nothing about which children it may open.
   * What the middleware calls, before any child has been named.
   */
  identify(secret: string): Promise<DeviceGrant | null>;
  /**
   * Whether this grant may open this child. Separate from `identify` because the answers have
   * different audiences: one is "we know this tablet", the other is "this tablet may wake
   * that child's account", and only the second one needs a child id to exist.
   */
  permits(grantId: string, studentId: string): Promise<boolean>;
}>;

export function createDevicesService(deps: {
  grants: DeviceGrantRepository;
  sessions: Pick<ChildSessionRepository, 'revokeAllForGrant'>;
  clock: Clock;
  ids: IdGenerator;
  tokens: TokenGenerator;
}): DevicesService {
  return {
    create: (input) => create(deps, input),
    list: (parentId) => deps.grants.listByParent(parentId),
    revoke: (parentId, grantId) => revoke(deps, parentId, grantId),
    identify: (secret) => identify(deps, secret),
    permits: (grantId, studentId) => deps.grants.permits(grantId, studentId),
  };
}

type Deps = Parameters<typeof createDevicesService>[0];

/** SHA-256, not argon2: nobody chose this secret, so there is nothing to slow down. */
export function hashDeviceSecret(secret: string): string {
  return createHash('sha256').update(secret, 'utf8').digest('hex');
}

async function create(
  deps: Deps,
  input: Readonly<{ parentId: string; label: string; studentIds: readonly string[] }>,
): Promise<IssuedDeviceGrant> {
  if (input.studentIds.length === 0) {
    // A grant that opens nobody is a secret with no purpose that still authenticates.
    throw new ForbiddenError('a device grant must name at least one child');
  }

  const secret = deps.tokens.next();
  const grant = await deps.grants.insert({
    id: deps.ids.next(),
    parentId: input.parentId,
    label: input.label,
    secretHash: hashDeviceSecret(secret),
    studentIds: input.studentIds,
    at: deps.clock.now(),
  });

  return { grant, secret };
}

async function revoke(deps: Deps, parentId: string, grantId: string): Promise<DeviceGrant> {
  const now = deps.clock.now();

  // `parent_id` is in the statement, so a grant belonging to another family is simply not
  // found — a parent cannot discover that a grant id exists by trying to revoke it.
  const grant = await deps.grants.revoke(grantId, parentId, now);
  if (grant === null) throw new NotFoundError(`device grant ${grantId} not found for this parent`);

  // Revoking a device a child is *currently using* has to sign them out of it. The cookie was
  // issued under this grant and would otherwise keep working until the session went idle,
  // which is the half hour a parent revoking a lost tablet is trying not to wait.
  //
  // Scoped to the grant, never to the child: the same child signed in on the tablet that is
  // still at home must not be signed out because a different one was lost.
  await deps.sessions.revokeAllForGrant(grant.id, now);

  return grant;
}

async function identify(deps: Deps, secret: string): Promise<DeviceGrant | null> {
  if (!wellFormed(secret)) return null;

  const grant = await deps.grants.findActiveBySecretHash(hashDeviceSecret(secret));
  if (grant === null) return null;

  // Last-seen is what makes a parent's device list usable: "the tablet nobody has touched
  // since March" is the one they want to revoke.
  await deps.grants.touch(grant.id, deps.clock.now());
  return grant;
}

/**
 * A cheap shape check before the database is asked. It also keeps a pathological header out
 * of a hash: the secret is 32 bytes base64url and nothing longer is worth reading.
 */
function wellFormed(secret: string): boolean {
  return secret.length >= 16 && secret.length <= 128 && /^[\w-]+$/u.test(secret);
}
