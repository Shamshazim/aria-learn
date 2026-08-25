import {
  realtimeCredentialsSchema,
  voiceTurnResponseSchema,
  type VoiceTurnResponse,
} from '@aria/shared';

import {
  realtimeParamsSchema,
  voiceConsentSchema,
  voiceConsentWithdrawSchema,
  workerVoiceMetricSchema,
  workerVoiceTurnSchema,
} from '@/schemas/voice.schema';
import type { ApiResponse } from '@/types/http';
import type { RealtimeCredentials, VoiceConsent } from '@/types/voice';

import type { Request, RequestHandler, Response } from 'express';

export type VoiceControllers = Readonly<{
  realtime: RequestHandler;
  workerTurn: RequestHandler;
  workerMetric: RequestHandler;
  grantConsent: RequestHandler;
  withdrawConsent: RequestHandler;
}>;

export function createVoiceControllers(deps: {
  negotiate(studentId: string, sessionId: string): Promise<RealtimeCredentials>;
  workerTurn(
    sessionId: string,
    input: ReturnType<typeof workerVoiceTurnSchema.parse>,
    signal?: AbortSignal,
  ): Promise<VoiceTurnResponse>;
  recordMetric(
    sessionId: string,
    input: ReturnType<typeof workerVoiceMetricSchema.parse>,
  ): Promise<void>;
  grant(input: ReturnType<typeof voiceConsentSchema.parse>): Promise<VoiceConsent>;
  withdraw(input: ReturnType<typeof voiceConsentWithdrawSchema.parse>): Promise<boolean>;
}): VoiceControllers {
  return {
    realtime: async (
      request: Request,
      response: Response<ApiResponse<ReturnType<typeof realtimeCredentialsSchema.parse>>>,
    ) => {
      const { id } = realtimeParamsSchema.parse(request.validated?.params);
      response.status(200).json({
        data: realtimeCredentialsSchema.parse(await deps.negotiate(studentId(request), id)),
      });
    },
    workerTurn: async (request: Request, response: Response<ApiResponse<VoiceTurnResponse>>) => {
      const { id } = realtimeParamsSchema.parse(request.validated?.params);
      const input = workerVoiceTurnSchema.parse(request.validated?.body);
      const controller = new AbortController();
      request.once('aborted', () => {
        controller.abort();
      });
      response.status(200).json({
        data: voiceTurnResponseSchema.parse(await deps.workerTurn(id, input, controller.signal)),
      });
    },
    workerMetric: async (request: Request, response: Response<ApiResponse<{ recorded: true }>>) => {
      const { id } = realtimeParamsSchema.parse(request.validated?.params);
      await deps.recordMetric(id, workerVoiceMetricSchema.parse(request.validated?.body));
      response.status(202).json({ data: { recorded: true } });
    },
    grantConsent: async (request, response: Response<ApiResponse<VoiceConsent>>) => {
      response
        .status(200)
        .json({ data: await deps.grant(voiceConsentSchema.parse(request.validated?.body)) });
    },
    withdrawConsent: async (request, response: Response<ApiResponse<{ withdrawn: boolean }>>) => {
      const input = voiceConsentWithdrawSchema.parse(request.validated?.body);
      response.status(200).json({ data: { withdrawn: await deps.withdraw(input) } });
    },
  };
}

function studentId(request: { studentId?: string }): string {
  if (request.studentId === undefined) throw new Error('student access middleware was not run');
  return request.studentId;
}
