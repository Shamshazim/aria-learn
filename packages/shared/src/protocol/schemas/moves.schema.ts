import { z } from 'zod';

import { ARRIVAL_MOVE_SCHEMAS } from './moves/arrival.schema';
import { RESPONSE_MOVE_SCHEMAS } from './moves/response.schema';
import { SESSION_MOVE_SCHEMAS } from './moves/session.schema';
import { TEACHING_MOVE_SCHEMAS } from './moves/teaching.schema';

/**
 * The fourteen moves Aria can make (`master-plan.md` §4.1), as one discriminated union.
 *
 * The kinds are declared in four groups — arrival, teaching, response, session — because
 * fourteen schemas in one file would breach the 300-line rule and because the groups are
 * what actually change together. This file is the union and nothing else.
 */
export const tutorMoveSchema = z.discriminatedUnion('kind', [
  ...ARRIVAL_MOVE_SCHEMAS,
  ...TEACHING_MOVE_SCHEMAS,
  ...RESPONSE_MOVE_SCHEMAS,
  ...SESSION_MOVE_SCHEMAS,
]);

export type TutorMove = z.infer<typeof tutorMoveSchema>;

export const MOVE_KINDS = [
  'WELCOME',
  'CHECK_IN',
  'RECOMMEND',
  'SAY',
  'SHOW',
  'ASK',
  'LISTEN',
  'HINT',
  'RETEACH',
  'REVEAL',
  'PRAISE',
  'SWITCH',
  'BREAK',
  'END',
] as const;

export type MoveKind = (typeof MOVE_KINDS)[number];

/**
 * The moves that are evidence about a skill, and so carry `skillId`.
 *
 * Teaching a thing and responding to an attempt at it are both about a skill; arriving,
 * switching class, taking a break and finishing are not. Callers building a move need this to
 * know whether `skillId` belongs on it — and since X-05 made every move schema strict, adding
 * it to a move that does not declare it is a parse failure rather than a field silently
 * dropped. `moves.strictness.test.ts` holds this list to the schemas.
 */
export const SKILL_EVIDENCE_MOVE_KINDS: readonly MoveKind[] = [
  'SAY',
  'SHOW',
  'ASK',
  'LISTEN',
  'HINT',
  'RETEACH',
  'REVEAL',
  'PRAISE',
];

export * from './moves/arrival.schema';
export * from './moves/response.schema';
export * from './moves/session.schema';
export * from './moves/teaching.schema';
