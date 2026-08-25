import type { RespondPromptInput } from '@/ai/prompts/types';
import { renderStreamRequest } from '@/ai/streaming/request';
import type {
  GatedStreamer,
  GatedStreamInput,
  ReleasedSegment,
  SpokenContext,
} from '@/ai/streaming/types';

/**
 * P2H-07: Aria's own words, released a sentence at a time.
 *
 * The gated streamer takes a rendered model request, which only the model layer may build. A
 * content service asks for a prompt instead — the same `respond` input it already assembles —
 * and gets back gated sentences. Nothing outside `ai/` sees a request, and nothing inside the
 * turn path can stream text that skipped the gate.
 */
export type RespondStreamInput = Omit<GatedStreamInput, 'request'> &
  Readonly<{
    promptInput: RespondPromptInput;
    /** Internal student id for cost accounting. Never rendered into the request. */
    studentId?: string;
  }>;

export type RespondStreamer = Readonly<{
  stream(input: RespondStreamInput): AsyncIterable<ReleasedSegment>;
}>;

export function createRespondStreamer(streamer: GatedStreamer): RespondStreamer {
  return {
    stream: ({ promptInput, studentId, ...rest }: RespondStreamInput) =>
      streamer.stream({
        ...rest,
        request: renderStreamRequest({
          name: 'respond-stream',
          input: promptInput,
          ...(studentId === undefined ? {} : { studentId }),
        }),
      }),
  };
}

export type { SpokenContext };
