import { z } from 'zod';

import { bandSchema, gradeSchema } from '../../band/band';

import {
  messageIdSchema,
  protocolVersionSchema,
  sessionIdSchema,
  timestampSchema,
} from './common.schema';
import { tutorInputEventSchema } from './events.schema';
import { tutorMoveSchema } from './moves.schema';
import { moveSegmentSchema } from './segment.schema';

/**
 * The turn envelope: one event in, one or more moves out.
 *
 * How the envelope travels — HTTP now, a live channel in Phase 2 — is not part of this
 * ticket and deliberately not encoded here. The envelope is the same either way, which is
 * what lets Phase 2 change the transport without changing the protocol.
 */

/** A turn may produce several moves: a `SAY` that explains, then the `ASK` that follows it. */
const MAX_MOVES_PER_TURN = 8;

export const turnRequestSchema = z.object({
  protocolVersion: protocolVersionSchema,
  sessionId: sessionIdSchema.optional(),
  event: tutorInputEventSchema,
});

export type TurnRequest = z.infer<typeof turnRequestSchema>;

export const turnResponseSchema = z.object({
  protocolVersion: protocolVersionSchema,
  sessionId: sessionIdSchema,
  /** Echoes the event that produced these moves, so a client can drop a stale turn. */
  inResponseTo: messageIdSchema,
  at: timestampSchema,
  moves: z.array(tutorMoveSchema).min(1).max(MAX_MOVES_PER_TURN),
});

export type TurnResponse = z.infer<typeof turnResponseSchema>;

/**
 * P2H-07: the text channel, over SSE — gated sentences, then the turn that closes them.
 *
 * The frames live beside the turn they carry rather than in `realtime.ts`, which is the voice
 * channel's own file. Both channels send the same `MOVE_SEGMENT`; only what closes a turn
 * differs, because the two transports acknowledge moves differently.
 */
export const turnFrameSchema = z.discriminatedUnion('kind', [
  moveSegmentSchema,
  z.object({ kind: z.literal('TURN_MOVES'), turn: turnResponseSchema }),
]);

export type TurnFrame = z.infer<typeof turnFrameSchema>;

/**
 * What the client needs to render a session before the first turn returns.
 *
 * `band` is resolved server-side from the child's grade so the two cannot disagree; the UI
 * renders the band it is given rather than deriving one from a grade string.
 */
export const sessionContextSchema = z.object({
  sessionId: sessionIdSchema,
  subjectId: z.string().min(1).max(64),
  grade: gradeSchema,
  band: bandSchema,
  startedAt: timestampSchema,
});

export type SessionContext = z.infer<typeof sessionContextSchema>;

export { sessionIdSchema };
export type { SessionId } from './common.schema';
