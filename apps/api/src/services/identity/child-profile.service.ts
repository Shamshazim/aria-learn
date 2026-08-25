import type { PictureSecret, Grade } from '@aria/shared';

import { ForbiddenError, NotFoundError } from '@/errors';
import { hashPictureSecret } from '@/identity';
import type { Clock } from '@/lib/clock';
import type { ChildSessionRepository } from '@/repositories/child-session.repository';
import type { DeletionRequestRepository } from '@/repositories/deletion-request.repository';
import type { StudentCredentialRepository } from '@/repositories/student-credential.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { AdultActor } from '@/types/identity';
import type { Student } from '@/types/student';

import type { ConsentService } from './consent.service';

/**
 * Child profiles, as the parent who owns them sees them.
 *
 * Every method starts from the parent, never from a child id the caller supplied: the id is
 * always checked against `actor.parentId` at the repository, in SQL. That is what makes one
 * family's endpoints useless against another family's children, and what keeps a parent's own
 * children separable from each other on deletion.
 *
 * Nothing here can run without consent. `requireParent` and `requireConsent` are the first two
 * lines of the two methods that create or open a child, in that order.
 */
export type CreateChildInput = Readonly<{
  actor: AdultActor;
  nickname: string;
  grade: Grade;
  avatarKey: string;
  /** The four pictures the child will tap. Hashed here and never stored or logged in the clear. */
  pictureSecret: PictureSecret;
}>;

export type ChildProfileService = Readonly<{
  create(input: CreateChildInput): Promise<Student>;
  list(actor: AdultActor): Promise<readonly Student[]>;
  /** Re-sets the picture secret; also the recovery path when a child forgets it. */
  setPictureSecret(input: {
    actor: AdultActor;
    studentId: string;
    avatarKey: string | null;
    pictureSecret: PictureSecret;
  }): Promise<void>;
  /** Erasure of one child, recorded in the deletion ledger before anything is destroyed. */
  remove(actor: AdultActor, studentId: string): Promise<void>;
}>;

export type ChildProfileServiceDeps = Readonly<{
  students: StudentRepository;
  credentials: StudentCredentialRepository;
  childSessions: ChildSessionRepository;
  deletions: DeletionRequestRepository;
  consent: ConsentService;
  clock: Clock;
}>;

/** A teacher has no `parentId`, and so has no route to a child through these endpoints. */
function requireParent(actor: AdultActor): string {
  if (actor.role !== 'parent' || actor.parentId === null) {
    throw new ForbiddenError(`adult ${actor.adultId} is not a parent and owns no child profiles`);
  }
  return actor.parentId;
}

export function createChildProfileService(deps: ChildProfileServiceDeps): ChildProfileService {
  const { students, credentials, childSessions, deletions, consent, clock } = deps;

  return {
    async create(input) {
      const parentId = requireParent(input.actor);
      await consent.requireConsent(input.actor.adultId);

      return students.insert({
        parentId,
        displayName: input.nickname,
        grade: input.grade,
        avatarKey: input.avatarKey,
        pictureSecretHash: await hashPictureSecret(input.pictureSecret),
      });
    },

    list: (actor) => students.listByParentId(requireParent(actor)),

    async setPictureSecret(input) {
      const parentId = requireParent(input.actor);
      await consent.requireConsent(input.actor.adultId);

      const updated = await credentials.setSecret({
        studentId: input.studentId,
        parentId,
        secretHash: await hashPictureSecret(input.pictureSecret),
        avatarKey: input.avatarKey,
      });
      if (!updated) throw new NotFoundError(`student ${input.studentId} is not this parent's`);

      // A changed secret must not leave an open session behind that was opened with the old
      // one — that is the case a parent resets a secret *for*.
      await childSessions.revokeAllForStudent(input.studentId, clock.now());
    },

    async remove(actor, studentId) {
      const parentId = requireParent(actor);

      // The ledger row is written first and deliberately outlives the cascade: if the process
      // dies mid-deletion, the intent is still on record and replayable.
      const request = await deletions.open({
        subjectKind: 'child',
        subjectId: studentId,
        provider: null,
        providerSubject: null,
      });

      const removed = await students.deleteById(studentId, parentId);
      if (!removed) throw new NotFoundError(`student ${studentId} is not this parent's`);

      // A child has no identity-provider row to chase, so local deletion is the whole of it.
      await deletions.advance(request.id, 'local_deleted');
      await deletions.complete(request.id, clock.now());
    },
  };
}
