import { voice, type llm } from '@livekit/agents';

import type { SafetyTap } from '@/session/s2s-safety-tap';

import type { ReadableStream } from 'node:stream/web';

type TimedString = voice.TimedString;

/**
 * P2H-15: the persona prompt for a model that is a mouth and not a tutor.
 *
 * Deliberately short. The P2H-03 persona describes how Aria teaches; this one says only that
 * the model does not decide what to say. A longer prompt would invite exactly the free chat
 * the tools exist to prevent, and every sentence the model improvises is an off-plan event.
 */
export const S2S_INSTRUCTIONS = [
  'You are the voice of Aria, a tutor for young children.',
  'You never decide what Aria says. When the child speaks, call plan_next_move with their exact words,',
  'or check_answer if they are answering the question Aria just asked. Say the returned sentences',
  'in order, word for word, warmly and at a pace a young child can follow, then call end_turn.',
  'Never add, shorten, translate or explain a sentence. Never answer a question yourself.',
  'If a tool returns nothing to say, stay quiet and wait for the child.',
].join(' ');

export type S2SAgentInput = Readonly<{
  tools: llm.ToolContextLike;
  tap: Pick<SafetyTap, 'observe'>;
  /** Off-plan speech reached the transcript; the caller cuts the audio. */
  onOffPlan(escapedWords: number): void;
}>;

/**
 * The transcript tap: every piece of the model's output text passes through here on its way
 * to captions, and an off-plan verdict is raised before the piece is forwarded. The audio
 * is already playing by then — what the tap buys is a cut measured in words, not sentences.
 */
export class AriaS2SAgent extends voice.Agent {
  private readonly tapInput: S2SAgentInput;

  constructor(input: S2SAgentInput) {
    super({ instructions: S2S_INSTRUCTIONS, tools: input.tools });
    this.tapInput = input;
  }

  override async transcriptionNode(
    text: ReadableStream<string | TimedString> | AsyncIterable<string | TimedString>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<string | TimedString> | null> {
    const tapped = tapTranscript(text, this.tapInput);
    return super.transcriptionNode(tapped, modelSettings);
  }
}

async function* tapTranscript(
  text: ReadableStream<string | TimedString> | AsyncIterable<string | TimedString>,
  input: Pick<S2SAgentInput, 'tap' | 'onOffPlan'>,
): AsyncIterable<string | TimedString> {
  for await (const chunk of text) {
    const verdict = input.tap.observe(typeof chunk === 'string' ? chunk : chunk.text);
    if (verdict.kind === 'off_plan') input.onOffPlan(verdict.escapedWords);
    yield chunk;
  }
}
