import type { Band, ChildPicture, Grade } from '@aria/shared';

/**
 * The part of a child's profile a parent owns (P2H-12).
 *
 * All three exist because a grown-up knows something the service cannot work out: how the
 * name is said, whether it may be said at all, and which picture the child will recognise as
 * theirs in the picker before they can read.
 */
export type StudentSettings = Readonly<{
  /** May Aria say this child's name out loud, or only their picture stand for them? */
  shareFirstName: boolean;
  /** A respelling for the speech engine, applied to spoken text only. Null when unset. */
  pronunciation: string | null;
  /** The picture that identifies this child in the picker. */
  avatar: ChildPicture;
}>;

/**
 * What a parent may change: any subset of the settings, and nothing else.
 *
 * `| undefined` is spelled out on every key because `exactOptionalPropertyTypes` makes an
 * absent key and an explicit `undefined` different things, and a parsed request body is the
 * second of those.
 */
export type StudentSettingsPatch = {
  [K in keyof StudentSettings]?: StudentSettings[K] | undefined;
};

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
  settings: StudentSettings;
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
  /** Omitted means the defaults: name may be spoken, no respelling, the first picture. */
  settings?: StudentSettings;
};
