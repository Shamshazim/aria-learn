import type { Band, Grade } from '@aria/shared';

/**
 * A student, as the rest of the service sees it.
 *
 * `grade` and `band` are the shared vocabulary from `@aria/shared`, not strings: a value that
 * reached this type has already been proven to be one of the ten grades or three bands, so no
 * consumer has to re-check and none can invent a fourth band.
 */
export type Student = {
  id: string;
  parentId: string;
  displayName: string;
  grade: Grade;
  band: Band;
  createdAt: Date;
};

/**
 * What a caller supplies. `band` is absent on purpose — it is a function of `grade`, and the
 * repository derives it, so the two cannot be stored disagreeing with each other.
 */
export type NewStudent = {
  parentId: string;
  displayName: string;
  grade: Grade;
  /**
   * The picture the child recognises themselves by, and the hash of the four pictures they
   * tap to open a session (P0-28). Optional because a student row can exist before a child
   * has a device to sign in from — a teacher-created roster entry, later.
   */
  avatarKey?: string | null;
  pictureSecretHash?: string | null;
};
