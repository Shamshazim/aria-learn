import type { ChildPicture, ChildSummary, Grade } from '@aria/shared';

import type { ChildCredentialService } from '@/auth';
import { NotFoundError, ValidationError } from '@/errors';
import { toChildSummary } from '@/mappers/child-summary.mapper';
import type { StudentRepository } from '@/repositories/student.repository';
import {
  DEFAULT_STUDENT_SETTINGS,
  type StudentSettingsPatch,
} from '@/schemas/student-settings.schema';
import type { Student } from '@/types/student';

/**
 * The child list a parent owns (P2H-12).
 *
 * Every method starts from a parent id that a verified JWT put there, and every one that names
 * a child re-checks that the child is theirs. That check is here rather than in the controller
 * because it is a fact about a family, and it is repeated on every call rather than trusted
 * from the last one because a parent id in a path is not proof of anything.
 */
/**
 * `| undefined` is spelled out on every optional key. Under `exactOptionalPropertyTypes` a
 * parsed request body has exactly that shape, and a patch type that refused it would push
 * every caller into rebuilding the object key by key to say the same thing.
 */
export type ChildLoginPatch = Readonly<{
  pin?: string | null | undefined;
  pictureSequence?: readonly ChildPicture[] | null | undefined;
  familyDevice?: boolean | undefined;
}>;

export type ChildProfilePatch = Readonly<{
  displayName?: string | undefined;
  grade?: Grade | undefined;
  settings?: StudentSettingsPatch | undefined;
  login?: ChildLoginPatch | undefined;
}>;

export type ParentChildrenService = Readonly<{
  list(parentId: string): Promise<readonly ChildSummary[]>;
  add(
    parentId: string,
    input: Readonly<{ displayName: string; grade: Grade; avatar?: ChildPicture }>,
  ): Promise<ChildSummary>;
  update(parentId: string, childId: string, patch: ChildProfilePatch): Promise<ChildSummary>;
  /** The student row behind a child, for a caller that has already proved the relationship. */
  requireOwned(parentId: string, childId: string): Promise<Student>;
}>;

export function createParentChildrenService(deps: {
  students: Pick<StudentRepository, 'listByParentId' | 'findById' | 'insert' | 'update'>;
  credentials: ChildCredentialService;
}): ParentChildrenService {
  const requireOwned = async (parentId: string, childId: string): Promise<Student> => {
    const student = await deps.students.findById(childId);
    if (student === null) throw new NotFoundError('child not found');
    // Same error either way: a parent probing ids must not learn which ones exist.
    if (student.parentId !== parentId) throw new NotFoundError('child belongs to another parent');
    return student;
  };

  const summarise = async (student: Student): Promise<ChildSummary> =>
    toChildSummary(student, await deps.credentials.methodFor(student.id));

  return {
    requireOwned,

    list: async (parentId) => {
      const students = await deps.students.listByParentId(parentId);
      return Promise.all(students.map(summarise));
    },

    add: async (parentId, input) => {
      const student = await deps.students.insert({
        parentId,
        displayName: input.displayName,
        grade: input.grade,
        ...(input.avatar === undefined ? {} : { settings: defaultsWith(input.avatar) }),
      });
      return summarise(student);
    },

    update: async (parentId, childId, patch) => {
      const current = await requireOwned(parentId, childId);
      const updated = await applyProfile(deps, current, patch);
      if (patch.login !== undefined) await applyLogin(deps, childId, patch.login);
      return summarise(updated);
    },
  };
}

type Deps = Parameters<typeof createParentChildrenService>[0];

/**
 * `band` is absent from the patch on purpose, and the ticket's `settings: { … }` is what a
 * parent actually changes. Band is a function of grade — migration 001 stores the pair and the
 * repository derives it — so accepting one would mean accepting a way to store them at odds.
 */
async function applyProfile(
  deps: Deps,
  current: Student,
  patch: ChildProfilePatch,
): Promise<Student> {
  if (patch.displayName === undefined && patch.grade === undefined && patch.settings === undefined)
    return current;
  const updated = await deps.students.update(current.id, {
    ...(patch.displayName === undefined ? {} : { displayName: patch.displayName }),
    ...(patch.grade === undefined ? {} : { grade: patch.grade }),
    ...(patch.settings === undefined
      ? {}
      : { settings: mergeSettings(current.settings, patch.settings) }),
  });
  if (updated === null) throw new NotFoundError('child disappeared while being updated');
  return updated;
}

/**
 * Refused before anything is written, not after: a call that clears every method at once
 * would otherwise lock the child out and *then* report that it should not have.
 */
async function applyLogin(deps: Deps, childId: string, login: ChildLoginPatch): Promise<void> {
  if (login.pin === null && login.pictureSequence === null && login.familyDevice === false) {
    throw new ValidationError('a child cannot be left with no way to sign in');
  }
  if (login.pin !== undefined) await deps.credentials.setPin(childId, login.pin);
  if (login.pictureSequence !== undefined) {
    await deps.credentials.setPictureSequence(childId, login.pictureSequence);
  }
  if (login.familyDevice !== undefined) {
    await deps.credentials.setFamilyDevice(childId, login.familyDevice);
  }
}

/**
 * Key by key, because `exactOptionalPropertyTypes` makes a spread of a partial mean "set this
 * to undefined" — which for `pronunciation` is a different instruction from "leave it alone".
 */
function mergeSettings(
  current: Student['settings'],
  patch: StudentSettingsPatch,
): Student['settings'] {
  return {
    shareFirstName: patch.shareFirstName ?? current.shareFirstName,
    pronunciation: patch.pronunciation === undefined ? current.pronunciation : patch.pronunciation,
    avatar: patch.avatar ?? current.avatar,
  };
}

function defaultsWith(avatar: ChildPicture): Student['settings'] {
  return { ...DEFAULT_STUDENT_SETTINGS, avatar };
}
