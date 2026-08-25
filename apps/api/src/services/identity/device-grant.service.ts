import { ForbiddenError, NotFoundError, ValidationError } from '@/errors';
import type { SecretGenerator } from '@/identity';
import { SECRET_KINDS, hashSecret } from '@/identity';
import type { Clock } from '@/lib/clock';
import type { ChildSessionRepository } from '@/repositories/child-session.repository';
import type { DeviceGrantRepository } from '@/repositories/device-grant.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { DeviceGrant, IssuedDeviceGrant } from '@/types/device-access';
import type { AdultActor } from '@/types/identity';

/**
 * Authorising a device, and taking that authorisation back.
 *
 * The secret exists exactly once, in the response that creates the grant. It is hashed before
 * it is stored and never returned again, so "show me the device code" is not a feature a
 * compromised parent session can use — the answer is to issue a new grant and revoke the old.
 *
 * Revoking is not only a flag on the grant. Every child session opened through it is revoked
 * in the same call, because a parent revoking a lost tablet means the session on that tablet
 * stops now, not in thirty minutes.
 */
export type DeviceGrantService = Readonly<{
  issue(input: {
    actor: AdultActor;
    label: string;
    studentIds: readonly string[];
  }): Promise<IssuedDeviceGrant>;
  list(actor: AdultActor): Promise<readonly DeviceGrant[]>;
  revoke(actor: AdultActor, grantId: string): Promise<void>;
}>;

export type DeviceGrantServiceDeps = Readonly<{
  grants: DeviceGrantRepository;
  students: StudentRepository;
  childSessions: ChildSessionRepository;
  secrets: SecretGenerator;
  clock: Clock;
}>;

function requireParent(actor: AdultActor): string {
  if (actor.role !== 'parent' || actor.parentId === null) {
    throw new ForbiddenError(
      `adult ${actor.adultId} is not a parent and cannot authorise a device`,
    );
  }
  return actor.parentId;
}

export function createDeviceGrantService(deps: DeviceGrantServiceDeps): DeviceGrantService {
  const { grants, students, childSessions, secrets, clock } = deps;

  return {
    async issue(input) {
      const parentId = requireParent(input.actor);

      // The repository's insert already refuses a child who is not this parent's, silently.
      // Checking here as well turns that silence into a 400 the parent can act on, and is
      // what stops a typo becoming a device that opens nothing.
      const owned = new Set((await students.listByParentId(parentId)).map((child) => child.id));
      const unknown = input.studentIds.filter((id) => !owned.has(id));
      if (input.studentIds.length === 0 || unknown.length > 0) {
        throw new ValidationError(
          `device grant names ${String(unknown.length)} child profiles this parent does not own`,
        );
      }

      const secret = secrets.issue(SECRET_KINDS.device);
      const grant = await grants.insert({
        parentId,
        label: input.label,
        secretHash: hashSecret(secret),
        studentIds: input.studentIds,
      });

      return { grant, secret };
    },

    list: (actor) => grants.listByParentId(requireParent(actor)),

    async revoke(actor, grantId) {
      const parentId = requireParent(actor);
      const now = clock.now();

      const grant = await grants.findById(grantId);
      if (grant?.parentId !== parentId) {
        throw new NotFoundError(`device grant ${grantId} is not this parent's`);
      }

      const revoked = await grants.revoke(grantId, parentId, now);
      if (!revoked) return;

      // Only the sessions opened on *this* device. A child signed in on the family tablet
      // must not be thrown out because a parent revoked the school laptop — and the join in
      // `findLiveByTokenHash` already refuses this grant, so this is the rows agreeing with
      // the predicate rather than the predicate's only enforcement.
      await childSessions.revokeAllForGrant(grantId, now);
    },
  };
}
