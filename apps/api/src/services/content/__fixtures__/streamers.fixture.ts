import type { RespondStreamer } from '@/ai';

export const FOUR_SENTENCES = [
  'Four plus three is seven.',
  'You can count on from four.',
  'Five, six, seven.',
  'That is the whole idea.',
];

/**
 * A streamer that has already done its job: these sentences passed the gate (P2H-07).
 *
 * What the gate does to a stream is proved where the stream lives — `ai/streaming` — and what
 * matters here is what the turn does with what comes out of it: who the sentences belong to,
 * which moves get to have them, and whether anyone was listening.
 */
export function scriptedStreamer(sentences: readonly string[] = FOUR_SENTENCES): RespondStreamer {
  return {
    stream: (input) =>
      (async function* () {
        // The real streamer buffers anything that is not sentence-streamable, so this one does
        // too: what the turn asks for is what decides how many segments come back.
        const released =
          input.contentKind === 'explanation' ? sentences : [sentences.join(' ')].filter(Boolean);
        for (const [index, written] of released.entries()) {
          yield await Promise.resolve({
            written,
            spoken: written,
            gateMs: 0,
            index,
            isLast: index === released.length - 1,
          });
        }
      })(),
  };
}

/**
 * A stream whose closing sentence is the reviewed static text, because the gate refused what
 * the model wrote next. This is what `gated-stream.ts` does on a mid-stream gate failure.
 */
export function substitutingAfter(sentences: number): RespondStreamer {
  return {
    stream: (input) =>
      (async function* () {
        for (let index = 0; index < sentences; index += 1) {
          const written = FOUR_SENTENCES[index] ?? '';
          yield await Promise.resolve({
            written,
            spoken: written,
            gateMs: 0,
            index,
            isLast: false,
          });
        }
        yield await Promise.resolve({
          written: input.fallbackText,
          spoken: input.fallbackText,
          gateMs: 0,
          index: sentences,
          isLast: true,
          substituted: true,
        });
      })(),
  };
}

/** A stream that dies part-way through, after the child has already heard something. */
export function failingAfter(sentences: number): RespondStreamer {
  return {
    stream: () =>
      (async function* () {
        for (const [index, written] of FOUR_SENTENCES.slice(0, sentences).entries()) {
          yield await Promise.resolve({
            written,
            spoken: written,
            gateMs: 0,
            index,
            isLast: false,
          });
        }
        throw new Error('safe test failure: the provider dropped the stream');
      })(),
  };
}
