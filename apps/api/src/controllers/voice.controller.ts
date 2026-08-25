import {
  realtimeCredentialsSchema,
  voiceTurnFrameSchema,
  voiceTurnResponseSchema,
  type VoiceTurnResponse,
} from '@aria/shared';

import { requestedFormat, streamTurn } from '@/controllers/turn-stream';
import type { Logger } from '@/lib/logger';
import {
  realtimeParamsSchema,
  voiceConsentSchema,
  voiceConsentWithdrawSchema,
  workerVoiceMetricSchema,
  workerVoiceTurnSchema,
} from '@/schemas/voice.schema';
import type { SegmentBus } from '@/services/content/segment-bus';
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
  /** P2H-07: present when the deployment can stream sentences ahead of the turn. */
  segments?: SegmentBus;
  logger?: Pick<Logger, 'warn'>;
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
    workerTurn: (request: Request, response: Response<ApiResponse<VoiceTurnResponse>>) =>
      workerTurn(deps, request, response),
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

/**
 * The worker's turn, streamed when it asks for it (P2H-07).
 *
 * The closing frame carries the same batch the buffered response always did — the moves the
 * worker has to publish and acknowledge. The sentences before it are what the child hears while
 * the batch is still being written.
 */
async function workerTurn(
  deps: Parameters<typeof createVoiceControllers>[0],
  request: Request,
  response: Response<ApiResponse<VoiceTurnResponse>>,
): Promise<void> {
  const { id } = realtimeParamsSchema.parse(request.validated?.params);
  const input = workerVoiceTurnSchema.parse(request.validated?.body);
  const controller = new AbortController();
  request.once('aborted', () => {
    controller.abort();
  });
  const run = async (): Promise<VoiceTurnResponse> =>
    voiceTurnResponseSchema.parse(await deps.workerTurn(id, input, controller.signal));
  const format = requestedFormat(request);
  const segments = deps.segments;
  if (format !== 'ndjson' || segments === undefined) {
    response.status(200).json({ data: await run() });
    return;
  }
  await streamTurn({
    response,
    format,
    segments,
    sessionId: id,
    frameSchema: voiceTurnFrameSchema,
    run,
    closing: (turn) => turn,
    onError: (error) => {
      deps.logger?.warn(
        { err: error, event: 'turn_stream_failed', sessionId: id },
        'A voice turn stopped after the child had already heard part of it',
      );
    },
  });
}

function studentId(request: { studentId?: string }): string {
  if (request.studentId === undefined) throw new Error('student access middleware was not run');
  return request.studentId;
}
