import type { AriaAgentSession } from '@/session/agent-session';
import type { MoveStream } from '@/session/move-stream';

/**
 * Every path from the tutor harness to the child's ears goes through here.
 *
 * A move stream yields already-gated speech, one string per move, and each one is spoken with
 * interruptions allowed — a child must always be able to talk over Aria.
 */
export async function speakStream(
  session: AriaAgentSession,
  stream: AsyncIterable<string>,
): Promise<void> {
  for await (const text of stream) session.say(text, { allowInterruptions: true });
}

/** Replays anything the child has not heard yet, then closes the room if that was the last move. */
export async function speakPending(
  session: AriaAgentSession,
  moves: MoveStream,
  finish: () => void,
): Promise<void> {
  await speakStream(session, moves.resume());
  finishSilentTerminal(moves, finish);
}

/** P2H-01: the child went quiet, so the harness decides the next rung of the ladder. */
export function speakSilence(
  session: AriaAgentSession,
  moves: MoveStream,
  payload: Readonly<{ waitedMs: number; afterMoveId: string }>,
): Promise<void> {
  return speakStream(session, moves.silence(payload));
}

/** A terminal move with nothing to say still ends the session; nothing else will arrive. */
export function finishSilentTerminal(moves: MoveStream, finish: () => void): void {
  if (moves.terminalDelivered() && !moves.terminalSpeechPending()) finish();
}
