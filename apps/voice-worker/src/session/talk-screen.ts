import { llm, type voice } from '@livekit/agents';
import { z } from 'zod';

import { SCREEN_SURFACES, type TutorMove, type VoiceClientEvent } from '@aria/shared';

import type { TalkClient } from '@/api/talk-client';
import {
  crisisInstruction,
  screenAnswerInstruction,
  typedOnScreen,
} from '@/session/talk-instructions';
import { outcome, type TalkToolHooks } from '@/session/talk-tools';

/**
 * The screen, in a session where Aria talks.
 *
 * It runs both ways. Aria puts things on it with `show_on_screen`: the API records the
 * surface as a `SHOW` move and the worker publishes it, so the browser opens a writing pad
 * or lays out choices through the same registry every move goes through. And what the child
 * does on it comes back as a `SCREEN_ANSWER`: an answer to the open question is graded by
 * the same path `record_answer` takes, and anything else — a paragraph in the writing pad —
 * reaches the model as words the child gave her, so she reads it and responds.
 */
export type ScreenAnswer = Extract<VoiceClientEvent, { kind: 'SCREEN_ANSWER' }>;

type RoomRef = Readonly<{ sessionId: string; connectionEpoch: number }>;

export type ScreenToolDeps = Readonly<{
  talk: Pick<TalkClient, 'screen'>;
  room: RoomRef;
  publish(move: TutorMove): Promise<void>;
}>;

export type ShownOutcome = Readonly<{ shown: string; move_id: string; instruction: string }>;

const parameters = z.object({
  surface: z
    .enum(SCREEN_SURFACES)
    .describe(
      'writing: a text area with your prompt above it. text: something to read. number: a problem with a number pad. choices: options to tap. clear: empty the screen.',
    ),
  text: z
    .string()
    .max(2000)
    .nullable()
    .default(null)
    .describe('The prompt, sentence, problem or question to show, in the exact words to display.'),
  options: z
    .array(z.string().max(300))
    .max(6)
    .nullable()
    .default(null)
    .describe('For choices only: the options to tap, in order.'),
});

export function createScreenTools(deps: ScreenToolDeps): Readonly<{
  show_on_screen: llm.AnonFunctionTool<z.infer<typeof parameters>, unknown, ShownOutcome>;
}> {
  return {
    show_on_screen: llm.tool({
      description:
        "Put something on the child's screen: a writing pad when you ask them to write, a sentence or problem to look at, choices to tap, a number pad, or clear it. Each question from record_answer is already on the screen; use this for everything else you want them to see.",
      parameters,
      execute: async (args) => {
        const text = args.text?.trim() ?? '';
        const options = (args.options ?? []).map((o) => o.trim()).filter((o) => o !== '');
        const { move } = await deps.talk.screen(deps.room.sessionId, {
          connectionEpoch: deps.room.connectionEpoch,
          surface: args.surface,
          ...(text === '' ? {} : { text }),
          ...(options.length < 2 ? {} : { options }),
        });
        await deps.publish(move);
        return {
          shown: args.surface,
          move_id: move.id,
          instruction:
            args.surface === 'clear'
              ? 'The screen is clear.'
              : 'It is on the screen now. Tell the child what to do with it, briefly, and wait.',
        };
      },
    }),
  };
}

export type ScreenAnswerDeps = Readonly<{
  session: Pick<voice.AgentSession, 'generateReply' | 'interrupt'>;
  hooks: TalkToolHooks;
  talk: Pick<TalkClient, 'heard'>;
  room: RoomRef;
  currentAsk(): TutorMove | null;
}>;

/** What the child did on the screen, brought into the conversation. */
export async function answerFromScreen(deps: ScreenAnswerDeps, event: ScreenAnswer): Promise<void> {
  const ask = deps.currentAsk();
  if (ask !== null && ask.id === event.moveId) {
    const result = await outcome(deps.hooks, deps.hooks.moves.answer(ask.id, event.text));
    deps.session.generateReply({
      instructions: screenAnswerInstruction(answerLabel(ask, event.text), result),
      allowInterruptions: true,
    });
    return;
  }
  const heard = await deps.talk.heard(deps.room.sessionId, {
    connectionEpoch: deps.room.connectionEpoch,
    text: event.text,
    via: 'screen',
  });
  if (heard.crisis !== null) {
    await deps.session.interrupt({ force: true }).await;
    deps.session.generateReply({
      instructions: crisisInstruction(heard.crisis.say),
      allowInterruptions: false,
    });
    return;
  }
  deps.session.generateReply({ userInput: typedOnScreen(event.text), allowInterruptions: true });
}

/** A tapped choice arrives as its id; the model should hear what the child saw on the tile. */
function answerLabel(ask: TutorMove, text: string): string {
  for (const item of ask.display) {
    if (item.type !== 'choices') continue;
    const option = item.options.find((o) => o.id === text);
    if (option !== undefined) return option.label;
  }
  return text;
}
