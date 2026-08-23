/**
 * The moves Aria can make.
 *
 * Every type here is `z.infer` of its schema. The kinds are grouped across four schema files
 * (arrival, teaching, response, session); this module is the single public surface for all
 * of them, so nothing outside the protocol imports a group file directly.
 */
export {
  tutorMoveSchema,
  MOVE_KINDS,
  welcomeMoveSchema,
  checkInMoveSchema,
  recommendMoveSchema,
  sayMoveSchema,
  showMoveSchema,
  askMoveSchema,
  listenMoveSchema,
  hintMoveSchema,
  reteachMoveSchema,
  revealMoveSchema,
  praiseMoveSchema,
  switchMoveSchema,
  breakMoveSchema,
  endMoveSchema,
} from './schemas/moves.schema';

export type { TutorMove, MoveKind } from './schemas/moves.schema';
