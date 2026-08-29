import { llm } from '@livekit/agents';
import { z } from 'zod';

import type { TutorMove } from '@aria/shared';

import type { MoveStream } from '@/session/move-stream';

/**
 * The two tools a talking Aria has ("Aria talks").
 *
 * The model talks freely; what it cannot do is decide whether an answer was right or move the
 * curriculum on. `record_answer` hands the child's words to the API's grader — the same
 * scoring, skill state and next-item choice the text tutor uses — and returns the verdict,
 * what the curriculum would have said, and the next question, for the model to voice in its
 * own words. `end_session` closes the session through the same policy path a child saying
 * "stop" reaches, so the ending is recorded like every other.
 */
export type TalkToolHooks = Readonly<{
  moves: Pick<MoveStream, 'answer' | 'handleTranscript' | 'terminalDelivered'>;
  /** The id of the latest `ASK` published to the room, or `null` before one exists. */
  currentAskId(): string | null;
  /** Moves published while a tool ran; the collector is reset by `beginTurn`. */
  beginTurn(): void;
  endTurn(): readonly TutorMove[];
  /** The session is over once the model has said goodbye. */
  onSessionOver(): void;
}>;

export type AnswerOutcome = Readonly<{
  verdict: 'correct' | 'not_yet' | 'unknown';
  teacher_says: readonly string[];
  next_question: Readonly<{
    id: string;
    prompt: string;
    options: readonly Readonly<{ id: string; text: string }>[];
  }> | null;
  session_over: boolean;
  instruction: string;
}>;

const STOP_WORDS = 'I want to stop now.';

export function createTalkTools(hooks: TalkToolHooks): Readonly<{
  record_answer: llm.AnonFunctionTool<{ answer: string }, unknown, AnswerOutcome>;
  end_session: llm.AnonFunctionTool<Record<string, never>, unknown, AnswerOutcome>;
}> {
  return {
    record_answer: llm.tool({
      description:
        'Grade what the child just answered to the open question. Returns the verdict, what the curriculum would say, and the next question to ask.',
      parameters: z.object({
        answer: z.string().min(1).max(2000).describe("The child's answer, as they said it."),
      }),
      execute: (args) => {
        const askId = hooks.currentAskId();
        const speech =
          askId === null
            ? hooks.moves.handleTranscript(args.answer)
            : hooks.moves.answer(askId, args.answer);
        return outcome(hooks, speech);
      },
    }),
    end_session: llm.tool({
      description: 'End the session because the child wants to stop or the session is over.',
      execute: () => outcome(hooks, hooks.moves.handleTranscript(STOP_WORDS)),
    }),
  };
}

/** Runs one harness turn and reads its moves for what the model needs to know. */
export async function outcome(
  hooks: TalkToolHooks,
  speech: AsyncIterable<string>,
): Promise<AnswerOutcome> {
  hooks.beginTurn();
  const teacherSays: string[] = [];
  for await (const line of speech) teacherSays.push(line);
  const moves = hooks.endTurn();
  const over = hooks.moves.terminalDelivered();
  if (over) hooks.onSessionOver();
  return {
    verdict: verdictOf(moves),
    teacher_says: teacherSays,
    next_question: nextQuestion(moves),
    session_over: over,
    instruction: over
      ? 'The session is over. Say a short, warm goodbye in your own words and stop.'
      : 'Respond in your own words. If there is a next question, ask it with every number and word exact.',
  };
}

function verdictOf(moves: readonly TutorMove[]): AnswerOutcome['verdict'] {
  if (moves.some((move) => move.kind === 'PRAISE')) return 'correct';
  if (moves.some((move) => move.kind === 'HINT' || move.kind === 'RETEACH' || move.kind === 'REVEAL'))
    return 'not_yet';
  return 'unknown';
}

function nextQuestion(moves: readonly TutorMove[]): AnswerOutcome['next_question'] {
  const ask = [...moves].reverse().find((move) => move.kind === 'ASK');
  if (ask?.speech == null) return null;
  return {
    id: ask.id,
    prompt: ask.speech.text,
    options: ask.display.flatMap((item) =>
      item.type === 'choices' ? item.options.map((o) => ({ id: o.id, text: o.label })) : [],
    ),
  };
}
