import { z } from 'zod';

import {
  voiceBriefSchema,
  voiceHeardResponseSchema,
  voiceScreenResponseSchema,
  voiceSpokenResponseSchema,
  type VoiceBrief,
  type VoiceHeardRequest,
  type VoiceHeardResponse,
  type VoiceScreenRequest,
  type VoiceScreenResponse,
  type VoiceSpokenRequest,
  type VoiceSpokenResponse,
} from '@aria/shared';

/**
 * The calls of a session where Aria talks: the brief the model teaches from, the two halves
 * of the transcript — what the child said and what Aria said — reported back so the API's
 * crisis check, output check and parent transcript are as complete as the pipeline's, and
 * the screen: a surface Aria wants in front of the child, returned as the move to publish.
 */
export type TalkClient = Readonly<{
  brief(sessionId: string, connectionEpoch: number): Promise<VoiceBrief>;
  heard(sessionId: string, body: VoiceHeardRequest): Promise<VoiceHeardResponse>;
  spoken(sessionId: string, body: VoiceSpokenRequest): Promise<VoiceSpokenResponse>;
  screen(sessionId: string, body: VoiceScreenRequest): Promise<VoiceScreenResponse>;
}>;

type ClientInput = Readonly<{ baseUrl: string; token: string; fetcher: typeof fetch }>;

export function createTalkClient(input: ClientInput): TalkClient {
  return {
    brief: async (sessionId, connectionEpoch) => {
      const response = await input.fetcher(
        `${url(input, sessionId, 'brief')}?connectionEpoch=${String(connectionEpoch)}`,
        { headers: { authorization: `Bearer ${input.token}` } },
      );
      return parse(response, voiceBriefSchema, 'brief');
    },
    heard: async (sessionId, body) =>
      parse(await post(input, sessionId, 'heard', body), voiceHeardResponseSchema, 'heard'),
    spoken: async (sessionId, body) =>
      parse(await post(input, sessionId, 'spoken', body), voiceSpokenResponseSchema, 'spoken'),
    screen: async (sessionId, body) =>
      parse(await post(input, sessionId, 'screen', body), voiceScreenResponseSchema, 'screen'),
  };
}

function post(input: ClientInput, sessionId: string, path: string, body: unknown): Promise<Response> {
  return input.fetcher(url(input, sessionId, path), {
    method: 'POST',
    headers: { authorization: `Bearer ${input.token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

async function parse<T>(response: Response, schema: z.ZodType<T>, what: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`Tutor control plane rejected voice ${what} (${String(response.status)})`);
  }
  return z.object({ data: schema }).parse(await response.json()).data;
}

function url(input: ClientInput, sessionId: string, path: string): string {
  return `${input.baseUrl}/api/v1/internal/voice/session/${encodeURIComponent(sessionId)}/${path}`;
}
