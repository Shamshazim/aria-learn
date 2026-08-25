import { z } from 'zod';

import {
  voiceTurnResponseSchema,
  type VoiceMetricRequest,
  type VoiceTurnRequest,
  type VoiceTurnResponse,
} from '@aria/shared';

const responseSchema = z.object({ data: voiceTurnResponseSchema });

export type TutorVoiceClient = Readonly<{
  turn(
    sessionId: string,
    input: VoiceTurnRequest,
    signal?: AbortSignal,
  ): Promise<VoiceTurnResponse>;
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
      const response = await input.fetcher(
        `${input.baseUrl}/api/v1/internal/voice/session/${encodeURIComponent(sessionId)}/turn`,
        {
          method: 'POST',
          headers: {
            authorization: `Bearer ${input.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify(body),
          ...(signal === undefined ? {} : { signal }),
        },
      );
      if (!response.ok)
        throw new Error(`Tutor control plane rejected voice turn (${String(response.status)})`);
      return responseSchema.parse(await response.json()).data;
    },
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
