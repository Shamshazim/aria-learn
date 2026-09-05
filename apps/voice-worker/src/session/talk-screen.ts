import { llm, type voice } from '@livekit/agents';
import { z } from 'zod';

import {
  SCREEN_SURFACES,
  type ScreenSurface,
  type TutorMove,
  type VoiceClientEvent,
} from '@aria/shared';

import type { TalkClient } from '@/api/talk-client';
import {
  crisisInstruction,
  screenAnswerInstruction,
  screenSkipInstruction,
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
 *
 * The open question owns the screen. Every question `record_answer` returns is already on it
 * with its answer control, and it stays there until the child answers: while one is open the
 * tool will put up one thing to read beside it, or open one writing pad for a question that
 * is answered in words, and refuses everything else with a reason the model can act on. A
 * screen that changed every time the model felt like it is what this replaces.
 */
export type ScreenAnswer = Extract<VoiceClientEvent, { kind: 'SCREEN_ANSWER' }>;
export type ScreenSkip = Extract<VoiceClientEvent, { kind: 'SCREEN_SKIP' }>;

type RoomRef = Readonly<{ sessionId: string; connectionEpoch: number }>;

export type ScreenToolDeps = Readonly<{
  talk: Pick<TalkClient, 'screen'>;
  room: RoomRef;
  publish(move: TutorMove): Promise<void>;
  /** The latest question on the screen; it decides what the tool may still put up. */
  currentAsk(): TutorMove | null;
}>;

export type ShownOutcome = Readonly<{
  shown: ScreenSurface | 'nothing';
  move_id: string | null;
  instruction: string;
}>;

/** What has been put up beside the question currently on the screen. */
type ScreenLedger = { askId: string | null; surfaces: Set<ScreenSurface> };

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
  const ledger: ScreenLedger = { askId: null, surfaces: new Set() };
  return {
    show_on_screen: llm.tool({
      description:
        "Put something on the child's screen. The open question is already there with its choices or its typing box, and it stays until the child answers. Use this to open a writing pad when you ask them to write words or sentences, or to put up one thing they must look at to answer (a word, a sentence, a problem). Not for what you are saying.",
      parameters,
      execute: async (args) => {
        const refusal = refusalFor(deps, ledger, args.surface);
        if (refusal !== null) return { shown: 'nothing', move_id: null, instruction: refusal };
        const text = args.text?.trim() ?? '';
        const options = (args.options ?? []).map((o) => o.trim()).filter((o) => o !== '');
        const { move } = await deps.talk.screen(deps.room.sessionId, {
          connectionEpoch: deps.room.connectionEpoch,
          surface: args.surface,
          ...(text === '' ? {} : { text }),
          ...(options.length < 2 ? {} : { options }),
        });
        await deps.publish(move);
        ledger.surfaces.add(args.surface);
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

/**
 * Why the screen stays as it is, or `null` when the surface may go up.
 *
 * With no question open anything goes. With one open, the question's own control is the
 * answer control: a pad may dress a question answered in words, once; one thing to read may
 * sit beside it, once; nothing may replace it.
 */
function refusalFor(
  deps: Pick<ScreenToolDeps, 'currentAsk'>,
  ledger: ScreenLedger,
  surface: ScreenSurface,
): string | null {
  const ask = deps.currentAsk();
  if (ask === null) return null;
  const shown = ledger;
  if (shown.askId !== ask.id) {
    shown.askId = ask.id;
    shown.surfaces.clear();
  }
  const stays = 'The screen stays as it is until the child answers; just talk.';
  if (surface === 'writing') {
    if (ask.expects !== 'text') {
      return `The open question is answered by tapping or saying it, not by writing, and its control is already on the screen. ${stays}`;
    }
    return ledger.surfaces.has('writing')
      ? `The writing pad is already open for this question. ${stays}`
      : null;
  }
  if (surface === 'text') {
    return ledger.surfaces.has('text')
      ? `You already put something up beside this question. ${stays}`
      : null;
  }
  return `The open question is already on the screen with its answer control. ${stays}`;
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

/**
 * The child pressed skip on the screen. The question is closed the same way `move_on` closes
 * it, and the model is told, so the voice says "no problem" and asks the next one instead of
 * carrying on with a question the screen no longer shows.
 */
export async function skipFromScreen(deps: ScreenAnswerDeps, event: ScreenSkip): Promise<void> {
  const ask = deps.currentAsk();
  const askId = ask !== null && ask.id === event.moveId ? ask.id : null;
  const result = await outcome(deps.hooks, deps.hooks.moves.skip(askId, 'child_asked'));
  deps.session.generateReply({
    instructions: screenSkipInstruction(result),
    allowInterruptions: true,
  });
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
