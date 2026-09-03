import {
  voiceBriefSchema,
  voiceHeardResponseSchema,
  voiceScreenResponseSchema,
  voiceSpokenResponseSchema,
  type TutorMove,
  type VoiceBrief,
  type VoiceHeardResponse,
  type VoiceScreenRequest,
  type VoiceScreenResponse,
  type VoiceSpokenResponse,
} from '@aria/shared';

import {
  realtimeParamsSchema,
  workerBriefQuerySchema,
  workerHeardSchema,
  workerScreenSchema,
  workerSpokenSchema,
} from '@/schemas/voice.schema';
import type { TalkEventsService } from '@/services/voice/talk-events.service';
import type { ApiResponse } from '@/types/http';

import type { Request, RequestHandler, Response } from 'express';

export type VoiceTalkControllers = Readonly<{
  brief: RequestHandler;
  heard: RequestHandler;
  spoken: RequestHandler;
  screen: RequestHandler;
}>;

/** The worker calls of a session where Aria talks; see `talk-brief.service.ts` and `talk-screen.service.ts`. */
export function createVoiceTalkControllers(deps: {
  brief(sessionId: string, connectionEpoch: number): Promise<VoiceBrief>;
  events: TalkEventsService;
  screen(sessionId: string, request: VoiceScreenRequest): Promise<TutorMove>;
}): VoiceTalkControllers {
  return {
    brief: async (request: Request, response: Response<ApiResponse<VoiceBrief>>) => {
      const { id } = realtimeParamsSchema.parse(request.validated?.params);
      const { connectionEpoch } = workerBriefQuerySchema.parse(request.validated?.query);
      response.status(200).json({ data: voiceBriefSchema.parse(await deps.brief(id, connectionEpoch)) });
    },
    heard: async (request: Request, response: Response<ApiResponse<VoiceHeardResponse>>) => {
      const { id } = realtimeParamsSchema.parse(request.validated?.params);
      const body = workerHeardSchema.parse(request.validated?.body);
      const result = await deps.events.heard(id, body.connectionEpoch, body.text, body.via);
      response.status(200).json({ data: voiceHeardResponseSchema.parse(result) });
    },
    spoken: async (request: Request, response: Response<ApiResponse<VoiceSpokenResponse>>) => {
      const { id } = realtimeParamsSchema.parse(request.validated?.params);
      const body = workerSpokenSchema.parse(request.validated?.body);
      const result = await deps.events.spoken(id, body.connectionEpoch, body.text);
      response.status(200).json({ data: voiceSpokenResponseSchema.parse(result) });
    },
    screen: async (request: Request, response: Response<ApiResponse<VoiceScreenResponse>>) => {
      const { id } = realtimeParamsSchema.parse(request.validated?.params);
      const body = workerScreenSchema.parse(request.validated?.body);
      const move = await deps.screen(id, body);
      response.status(200).json({ data: voiceScreenResponseSchema.parse({ move }) });
    },
  };
}
