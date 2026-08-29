import { llm } from '@livekit/agents';
import { z } from 'zod';

import type { MoveStream } from '@/session/move-stream';
import type { SafetyTap } from '@/session/s2s-safety-tap';

/**
 * P2H-15: tools, not free chat.
 *
 * The realtime model gets exactly three tools and may only voice what `plan_next_move` and
 * `check_answer` return. Both are thin adapters over the same move stream the pipeline uses,
 * so curriculum, memory, grading and the silence ladder stay in the API and `packages/tutor`;
 * the model is a mouth and an ear, not a tutor. `end_turn` is how the model says it has
 * finished voicing the plan, which is what the measurement harness times against.
 */
export type S2SToolHooks = Readonly<{
  moves: Pick<MoveStream, 'handleTranscript' | 'answer'>;
  tap: Pick<SafetyTap, 'allow'>;
  /** The id of the latest `ASK` published to the room, or `null` before one exists. */
  currentAskId(): string | null;
  /** The model announced the end of a spoken turn. */
  onTurnEnded(): void;
}>;

export type PlannedSpeech = Readonly<{ say: readonly string[]; instruction: string }>;

const VERBATIM =
  'Say every sentence in `say`, in order, word for word, and nothing else. Then call end_turn.';
const NOTHING = 'There is nothing to say. Call end_turn and wait for the child.';

export function createS2STools(hooks: S2SToolHooks): Readonly<{
  plan_next_move: llm.AnonFunctionTool<{ child_said: string }, unknown, PlannedSpeech>;
  check_answer: llm.AnonFunctionTool<{ answer: string }, unknown, PlannedSpeech>;
  end_turn: llm.AnonFunctionTool<Record<string, never>, unknown, Readonly<{ ok: true }>>;
}> {
  return {
    plan_next_move: llm.tool({
      description:
        'Call this with what the child just said, every time they speak. It returns the exact sentences Aria says next.',
      parameters: z.object({
        child_said: z.string().min(1).max(2000).describe('What the child said, verbatim.'),
      }),
      execute: (args) => plan(hooks, hooks.moves.handleTranscript(args.child_said)),
    }),
    check_answer: llm.tool({
      description:
        'Call this instead of plan_next_move when the child answers the question Aria just asked. It grades the answer and returns the exact sentences Aria says next.',
      parameters: z.object({
        answer: z.string().min(1).max(2000).describe("The child's answer, as they said it."),
      }),
      execute: (args) => {
        const askId = hooks.currentAskId();
        // No open question means this was not an answer; the planner decides what it was.
        const speech =
          askId === null
            ? hooks.moves.handleTranscript(args.answer)
            : hooks.moves.answer(askId, args.answer);
        return plan(hooks, speech);
      },
    }),
    end_turn: llm.tool({
      description: 'Call this after you have said every sentence from the last plan.',
      execute: () => {
        hooks.onTurnEnded();
        return Promise.resolve({ ok: true } as const);
      },
    }),
  };
}

/** Collects the harness's gated sentences and registers them as the only allowed speech. */
export async function plan(
  hooks: Pick<S2SToolHooks, 'tap'>,
  speech: AsyncIterable<string>,
): Promise<PlannedSpeech> {
  const say: string[] = [];
  for await (const line of speech) say.push(line);
  hooks.tap.allow(say);
  return { say, instruction: say.length === 0 ? NOTHING : VERBATIM };
}
