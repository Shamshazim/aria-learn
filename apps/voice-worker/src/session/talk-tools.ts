import { llm } from '@livekit/agents';
import { z } from 'zod';

import { SKIP_REASONS, type TutorMove } from '@aria/shared';
import { MASTERED_TOPIC_REASON } from '@aria/tutor';

import type { MoveStream } from '@/session/move-stream';

/**
 * The tools a talking Aria has ("Aria talks").
 *
 * The model talks freely; what it cannot do is decide whether an answer was right or move the
 * curriculum on. `record_answer` hands the child's words to the API's grader — the same
 * scoring, skill state and next-item choice the text tutor uses — and returns the verdict,
 * what the curriculum would have said, and the next question, for the model to voice in its
 * own words. `move_on` closes a question the child has given up on, or asked to skip, and
 * returns the next one: without it the model's only move was to ask the same question again.
 * `end_session` closes the session through the same policy path a child saying "stop"
 * reaches, so the ending is recorded like every other.
 */
export type TalkToolHooks = Readonly<{
  moves: Pick<MoveStream, 'answer' | 'skip' | 'handleTranscript' | 'terminalDelivered'>;
  /** The id of the latest `ASK` published to the room, or `null` before one exists. */
  currentAskId(): string | null;
  /** Moves published while a tool ran; the collector is reset by `beginTurn`. */
  beginTurn(): void;
  endTurn(): readonly TutorMove[];
  /** The session is over once the model has said goodbye. */
  onSessionOver(): void;
  /**
   * The lesson moved to another topic (a `SWITCH` was published). Returns a line describing
   * the new topic for the model, after the prompt has been rewritten around it.
   */
  onTopicChanged?(): Promise<string | null>;
}>;

export type AnswerOutcome = Readonly<{
  verdict: 'correct' | 'not_yet' | 'unknown';
  teacher_says: readonly string[];
  next_question: Readonly<{
    id: string;
    prompt: string;
    options: readonly Readonly<{ id: string; text: string }>[];
  }> | null;
  /** Set when the lesson moved to a new topic this turn: what it is, for the model. */
  new_topic: string | null;
  session_over: boolean;
  instruction: string;
}>;

const STOP_WORDS = 'I want to stop now.';

export function createTalkTools(hooks: TalkToolHooks): Readonly<{
  record_answer: llm.AnonFunctionTool<{ answer: string }, unknown, AnswerOutcome>;
  move_on: llm.AnonFunctionTool<{ reason: (typeof SKIP_REASONS)[number] }, unknown, AnswerOutcome>;
  end_session: llm.AnonFunctionTool<Record<string, never>, unknown, AnswerOutcome>;
}> {
  return {
    record_answer: llm.tool({
      description:
        'Call this the moment the child responds to the open question in any way: a right or wrong answer, a guess, "I don\'t know", "this is too hard". It grades or interprets what they said and tells you what to do next: a hint, another explanation, the answer and a fresh question, or praise and the next question.',
      parameters: z.object({
        answer: z
          .string()
          .min(1)
          .max(2000)
          .describe("The child's words, exactly as they said them."),
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
    move_on: llm.tool({
      description:
        'Close the open question and get a fresh one. Call it when the child asks to skip, wants a different question, says "I give up", or has clearly stopped engaging with this one. The answer is shown kindly and the next question is returned.',
      parameters: z.object({
        reason: z
          .enum(SKIP_REASONS)
          .describe(
            'child_asked: they asked to skip or for a different one. not_engaging: they have stopped trying. too_hard: they are lost and further hints will not help. too_easy: they find it trivial.',
          ),
      }),
      execute: (args) => outcome(hooks, hooks.moves.skip(hooks.currentAskId(), args.reason)),
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
  const switched = moves.some((move) => move.kind === 'SWITCH');
  const newTopic = switched ? ((await hooks.onTopicChanged?.()) ?? null) : null;
  return {
    verdict: verdictOf(moves),
    teacher_says: teacherSays,
    next_question: nextQuestion(moves),
    new_topic: newTopic,
    session_over: over,
    instruction: instructionFor({ over, moves, newTopic }),
  };
}

function instructionFor(
  input: Readonly<{ over: boolean; moves: readonly TutorMove[]; newTopic: string | null }>,
): string {
  if (input.over)
    return 'The session is over. Say a short, warm goodbye in your own words and stop.';
  const parts = ['Respond in your own words.'];
  if (input.moves.some((move) => move.kind === 'REVEAL')) {
    parts.push(
      'Say the answer kindly with one short reason, no consolation, then ask the next question.',
    );
  }
  if (input.newTopic !== null) {
    parts.push(
      'The lesson has moved to a new topic; say so in a few words and teach it from now on.',
    );
  }
  parts.push('If there is a next question, ask it with every number and word exact, then wait.');
  return parts.join(' ');
}

function verdictOf(moves: readonly TutorMove[]): AnswerOutcome['verdict'] {
  if (moves.some((move) => move.kind === 'PRAISE')) return 'correct';
  // A step forward to the next topic is made on a right answer; a step back is not.
  if (moves.some((move) => move.kind === 'SWITCH' && move.reason === MASTERED_TOPIC_REASON)) {
    return 'correct';
  }
  if (
    moves.some((move) => move.kind === 'HINT' || move.kind === 'RETEACH' || move.kind === 'REVEAL')
  )
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
