import {
  sessionContextSchema,
  type CurrentSessionResponse,
  type EndSessionResponse,
  type SessionStartResponse,
  type TurnResponse,
} from '@aria/shared';

import type { CreateSessionRequest, SessionTurnRequest } from '@/schemas/session.schema';
import {
  createSessionRequestSchema,
  endSessionRequestSchema,
  sessionTurnRequestSchema,
} from '@/schemas/session.schema';
import type { ResumedSession } from '@/services/session/resume.service';
import type { SessionStart } from '@/services/session/session.service';
import type { ApiResponse } from '@/types/http';
import type { SessionEndReason, TutorSessionRecord } from '@/types/session';

import type { Request, RequestHandler, Response } from 'express';

export type SessionControllers = Readonly<{
  create: RequestHandler;
  current: RequestHandler;
  end: RequestHandler;
  turn: RequestHandler;
}>;

export function createSessionControllers(deps: {
  sessions: Readonly<{
    createOrResume(
      input: CreateSessionRequest & Readonly<{ studentId: string }>,
    ): Promise<SessionStart>;
    current(studentId: string): Promise<ResumedSession | null>;
  }>;
  end(
    input: Readonly<{ sessionId: string; studentId: string; reason: SessionEndReason }>,
  ): Promise<TutorSessionRecord | null>;
  turn(studentId: string, request: SessionTurnRequest, signal?: AbortSignal): Promise<TurnResponse>;
}): SessionControllers {
  return {
    create: async (request: Request, response: Response<ApiResponse<SessionStartResponse>>) => {
      const body = createSessionRequestSchema.parse(request.validated?.body);
      const result = await deps.sessions.createOrResume({ ...body, studentId: studentId(request) });
      response.status(200).json({ data: startDto(result) });
    },
    current: async (request, response: Response<ApiResponse<CurrentSessionResponse>>) => {
      const result = await deps.sessions.current(studentId(request));
      response.status(200).json({ data: result === null ? null : currentDto(result) });
    },
    end: async (request: Request, response: Response<ApiResponse<EndSessionResponse>>) => {
      const body = endSessionRequestSchema.parse(request.validated?.body);
      const result = await deps.end({ ...body, studentId: studentId(request) });
      if (result?.endedAt === null || result?.endedAt === undefined || result.endReason === null) {
        throw new Error('session end failed');
      }
      response.status(200).json({
        data: {
          sessionId: result.id,
          endedAt: result.endedAt.toISOString(),
          reason: result.endReason,
        },
      });
    },
    turn: async (request: Request, response: Response<ApiResponse<TurnResponse>>) => {
      const body = sessionTurnRequestSchema.parse(request.validated?.body);
      const controller = new AbortController();
      const abort = (): void => {
        controller.abort();
      };
      request.once('aborted', abort);
      try {
        response
          .status(200)
          .json({ data: await deps.turn(studentId(request), body, controller.signal) });
      } finally {
        request.off('aborted', abort);
      }
    },
  };
}

function startDto(input: SessionStart): SessionStartResponse {
  return { session: contextDto(input.session), moves: [...input.moves], resumed: input.resumed };
}

function currentDto(input: ResumedSession): NonNullable<CurrentSessionResponse> {
  return {
    session: contextDto(input.session),
    moves: [...input.moves],
    lastAppliedSeq: input.lastAppliedSeq,
  };
}

function contextDto(session: TutorSessionRecord): SessionStartResponse['session'] {
  return sessionContextSchema.parse({
    sessionId: session.id,
    subjectId: session.subject,
    grade: session.grade,
    band: session.band,
    startedAt: session.startedAt.toISOString(),
  });
}

function studentId(request: { studentId?: string }): string {
  if (request.studentId === undefined) throw new Error('student access middleware was not run');
  return request.studentId;
}
