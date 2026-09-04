import { voice, type llm } from '@livekit/agents';

import type { ReadableStream } from 'node:stream/web';

type TimedString = voice.TimedString;

export type TalkAgentInput = Readonly<{
  instructions: string;
  tools: llm.ToolContextLike;
  /** A whole sentence Aria said, as the model transcribed it. */
  onSentence(text: string): void;
}>;

/**
 * Aria, talking: the realtime model is the agent, and the only thing added is a tap on its
 * output transcript that hands each finished sentence to the caller — for the API's
 * transcript and its unsafe-output check. The audio is already playing by then; what the tap
 * buys is a cut measured in sentences, which is what a spoken conversation can offer.
 */
export class AriaTalkAgent extends voice.Agent {
  private readonly input: TalkAgentInput;

  constructor(input: TalkAgentInput) {
    super({ instructions: input.instructions, tools: input.tools });
    this.input = input;
  }

  override async transcriptionNode(
    text: ReadableStream<string | TimedString> | AsyncIterable<string | TimedString>,
    modelSettings: voice.ModelSettings,
  ): Promise<ReadableStream<string | TimedString> | null> {
    return super.transcriptionNode(sentencesOf(text, this.input.onSentence), modelSettings);
  }
}

/** Passes chunks through untouched and reports each sentence once it has ended. */
export async function* sentencesOf(
  text: ReadableStream<string | TimedString> | AsyncIterable<string | TimedString>,
  onSentence: (sentence: string) => void,
): AsyncIterable<string | TimedString> {
  let buffer = '';
  for await (const chunk of text) {
    buffer += typeof chunk === 'string' ? chunk : chunk.text;
    let boundary = buffer.search(/[.!?]["')\]]?\s/u);
    while (boundary !== -1) {
      const end = boundary + buffer.slice(boundary).search(/\s/u);
      report(buffer.slice(0, end), onSentence);
      buffer = buffer.slice(end).trimStart();
      boundary = buffer.search(/[.!?]["')\]]?\s/u);
    }
    yield chunk;
  }
  report(buffer, onSentence);
}

function report(sentence: string, onSentence: (sentence: string) => void): void {
  const trimmed = sentence.trim();
  if (trimmed !== '') onSentence(trimmed);
}
