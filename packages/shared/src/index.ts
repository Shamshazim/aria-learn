/**
 * The public surface of `@aria/shared` — re-exports only.
 *
 * This package holds what both sides genuinely need: the tutor event/move protocol, the band
 * vocabulary, and their zod schemas. It has no runtime dependency on React, Express or a
 * database driver, and only one runtime dependency at all (zod).
 *
 * Anything not exported here is internal to the package.
 */

export { PROTOCOL_VERSION } from './version';
export type { ProtocolVersion } from './version';

export { BANDS, GRADES, bandSchema, gradeSchema, bandForGrade, parseGrade } from './band/band';
export type { Band, Grade } from './band/band';

export {
  CHILD_PICTURES,
  PICTURE_SEQUENCE_LENGTH,
  PIN_LENGTH,
  childPictureSchema,
  pictureSequenceSchema,
  pinSchema,
} from './identity/pictures';
export type { ChildPicture } from './identity/pictures';

export { VISUAL_KINDS } from './curriculum';
export type {
  Misconception,
  RemediationApproach,
  Skill,
  SkillSubject,
  VisualKind,
} from './curriculum';

export * from './protocol/events';
export * from './protocol/moves';
export * from './protocol/content';
export * from './protocol/session';
export * from './protocol/realtime';
export * from './protocol/talk';
export {
  childListResponseSchema,
  childSessionResponseSchema,
  childSummarySchema,
} from './protocol/schemas/identity.schema';
export type {
  ChildListResponse,
  ChildSessionResponse,
  ChildSummary,
} from './protocol/schemas/identity.schema';
export {
  arrivalResponseSchema,
  currentSessionResponseSchema,
  endSessionResponseSchema,
  sessionStartResponseSchema,
} from './protocol/schemas/phase1.schema';
export type {
  ArrivalResponse,
  CurrentSessionResponse,
  EndSessionResponse,
  SessionStartResponse,
} from './protocol/schemas/phase1.schema';
