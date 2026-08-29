import type { MoveSegment, TutorInputEvent, TutorMove } from '@aria/shared';

/**
 * What a turn produces: the moves, and — where the transport supports it — the sentences of a
 * move as they are written (P2H-07). A segment is not a move: it says nothing about what the
 * child is expected to do, and it is always superseded by the move that carries it.
 */
export type TutorOutput = TutorMove | MoveSegment;

export type TutorSource = Readonly<{
  send(event: TutorInputEvent, signal?: AbortSignal): AsyncIterable<TutorOutput>;
  close(): void;
}>;

/** Narrows a turn's output to the moves; a segment is a preview of one, not one of them. */
export function isTutorMove(output: TutorOutput): output is TutorMove {
  return output.kind !== 'MOVE_SEGMENT';
}

export class ContentUnavailableError extends Error {
  constructor() {
    super('Verified content is temporarily unavailable');
    this.name = 'ContentUnavailableError';
  }
}

/**
 * The API answered, and said no — a stale question, an ended session, a rejected payload.
 *
 * It is not `ContentUnavailableError`: nothing is down, so the internet sentence would be a
 * lie. The child is told the answer did not go through and offered another try.
 */
export class TurnRejectedError extends Error {
  constructor(readonly code: string) {
    super('Aria did not accept that turn');
    this.name = 'TurnRejectedError';
  }
}
