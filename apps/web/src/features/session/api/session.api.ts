import {
  currentSessionResponseSchema,
  endSessionResponseSchema,
  sessionStartResponseSchema,
  turnResponseSchema,
  type Grade,
  type CurrentSessionResponse,
  type EndSessionResponse,
  type SessionStartResponse,
  type TurnResponse,
  type TurnRequest,
} from '@aria/shared';

import type { ApiClient } from '@/api/client';

export type SessionApi = Readonly<{
  current(signal?: AbortSignal): Promise<CurrentSessionResponse>;
  create(
    input: Readonly<{
      subject: string;
      grade: Grade;
      arrivalId?: string;
      fromRecommendation: boolean;
      checkIn?: string;
    }>,
    signal?: AbortSignal,
  ): Promise<SessionStartResponse>;
  turn(input: TurnRequest, signal?: AbortSignal): Promise<TurnResponse>;
  end(
    sessionId: string,
    reason: 'complete' | 'break' | 'child_left' | 'timeout',
  ): Promise<EndSessionResponse>;
}>;

export function createSessionApi(client: ApiClient): SessionApi {
  return {
    current: (signal?: AbortSignal) =>
      client.get(
        '/api/v1/student/session/current',
        currentSessionResponseSchema,
        signal === undefined ? undefined : { signal },
      ),
    create: (
      input: Readonly<{
        subject: string;
        grade: Grade;
        arrivalId?: string;
        fromRecommendation: boolean;
        checkIn?: string;
      }>,
      signal?: AbortSignal,
    ) =>
      client.post(
        '/api/v1/student/session',
        input,
        sessionStartResponseSchema,
        signal === undefined ? undefined : { signal },
      ),
    turn: (input: TurnRequest, signal?: AbortSignal) =>
      client.post(
        '/api/v1/student/session/turn',
        input,
        turnResponseSchema,
        signal === undefined ? undefined : { signal },
      ),
    end: (sessionId: string, reason: 'complete' | 'break' | 'child_left' | 'timeout') =>
      client.post('/api/v1/student/session/end', { sessionId, reason }, endSessionResponseSchema),
  };
}
