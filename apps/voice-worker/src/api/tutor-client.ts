import { z } from 'zod';

import {
  voiceTurnFrameSchema,
  voiceTurnResponseSchema,
  type VoiceMetricRequest,
  type VoiceTurnFrame,
  type VoiceTurnRequest,
  type VoiceTurnResponse,
} from '@aria/shared';

import { readNdjson, STREAM_IDLE_TIMEOUT_MS, untilIdle } from '@/api/ndjson';

const responseSchema = z.object({ data: voiceTurnResponseSchema });

export type TutorVoiceClient = Readonly<{
  turn(
    sessionId: string,
    input: VoiceTurnRequest,
    signal?: AbortSignal,
  ): Promise<VoiceTurnResponse>;
  /**
   * P2H-07: the same turn, but each gated sentence arrives while the rest is still being
   * written, and the move batch closes it. A stream that ends without that closing frame
   * failed partway through and is raised as an error rather than treated as an empty turn.
   */
  turnStream(
    sessionId: string,
    input: VoiceTurnRequest,
    signal?: AbortSignal,
  ): AsyncIterable<VoiceTurnFrame>;
  metric(sessionId: string, input: VoiceMetricRequest): Promise<void>;
}>;

export function createTutorVoiceClient(
  input: Readonly<{
    baseUrl: string;
    token: string;
    fetcher: typeof fetch;
  }>,
): TutorVoiceClient {
  return {
    turn: async (sessionId, body, signal) => {
      const response = await input.fetcher(turnUrl(input.baseUrl, sessionId), {
        method: 'POST',
        headers: {
          authorization: `Bearer ${input.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(body),
        ...(signal === undefined ? {} : { signal }),
      });
      if (!response.ok)
        throw new Error(`Tutor control plane rejected voice turn (${String(response.status)})`);
      return responseSchema.parse(await response.json()).data;
    },
    turnStream: (sessionId, body, signal) => turnStream(input, sessionId, body, signal),
    metric: async (sessionId, body) => {
      const response = await input.fetcher(
        `${input.baseUrl}/api/v1/internal/voice/session/${encodeURIComponent(sessionId)}/metrics`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${input.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok)
        throw new Error(`Tutor control plane rejected voice metric (${String(response.status)})`);
    },
  };
}

async function* turnStream(
  input: Parameters<typeof createTutorVoiceClient>[0],
  sessionId: string,
  body: VoiceTurnRequest,
  signal?: AbortSignal,
): AsyncIterable<VoiceTurnFrame> {
  const response = await input.fetcher(turnUrl(input.baseUrl, sessionId), {
    method: 'POST',
    headers: {
      authorization: `Bearer ${input.token}`,
      'content-type': 'application/json',
      accept: 'application/x-ndjson',
    },
    body: JSON.stringify(body),
    ...(signal === undefined ? {} : { signal }),
  });
  if (!response.ok || response.body === null) {
    throw new Error(`Tutor control plane rejected voice turn (${String(response.status)})`);
  }
  let closed = false;
  // A stream that goes quiet raises on its own, so the only case left here is a control plane
  // that closed the connection tidily without ever saying what the turn was.
  for await (const line of untilIdle(readNdjson(response.body), STREAM_IDLE_TIMEOUT_MS)) {
    const frame = voiceTurnFrameSchema.parse(line);
    closed = frame.kind === 'TURN_MOVES';
    yield frame;
  }
  if (!closed) throw new Error('Tutor control plane ended a voice turn without its moves');
}

function turnUrl(baseUrl: string, sessionId: string): string {
  return `${baseUrl}/api/v1/internal/voice/session/${encodeURIComponent(sessionId)}/turn`;
}
