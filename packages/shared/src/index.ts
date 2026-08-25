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

export type { Misconception, Skill, SkillSubject } from './curriculum';

export * from './protocol/events';
export * from './protocol/moves';
export * from './protocol/content';
export * from './protocol/session';
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
