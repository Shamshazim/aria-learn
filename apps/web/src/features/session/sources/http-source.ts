import {
  PROTOCOL_VERSION,
  type Grade,
  type SessionId,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';

import type { SessionApi } from '@/features/session/api/session.api';
import { ContentUnavailableError } from '@/features/session/model/tutor-source';
import type { TutorSource } from '@/features/session/model/tutor-source';
import { retryRead } from '@/features/session/sources/retry';

export function createHttpTutorSource(
  input: Readonly<{
    api: SessionApi;
    grade: Grade;
    subject: string;
    arrivalId?: string;
    fromRecommendation: boolean;
    checkIn?: string;
    onSessionStarted?(sessionId: string): void;
  }>,
): TutorSource {
  let sessionId: SessionId | null = null;
  let closed = false;
  const isClosed = (): boolean => closed;
  return {
    send: async function* (event, signal) {
      if (isClosed() || isAborted(signal) || event.kind === 'ARRIVED') return;
      const batch = await recoverable(
        event.kind === 'SUBJECT_CHOSEN'
          ? startOrResume(input, signal)
          : sendTurn(input.api, requireSessionId(sessionId), event, signal),
        signal,
      );
      if (batch === null) return;
      if (event.kind === 'SUBJECT_CHOSEN') {
        sessionId = batch.sessionId;
        input.onSessionStarted?.(batch.sessionId);
      }
      for (const move of batch.moves) {
        if (isClosed() || isAborted(signal)) return;
        yield move;
      }
    },
    close: () => {
      closed = true;
    },
  };
}

async function recoverable(
  batch: Promise<MoveBatch>,
  signal: AbortSignal | undefined,
): Promise<MoveBatch | null> {
  try {
    return await batch;
  } catch {
    if (isAborted(signal)) return null;
    throw new ContentUnavailableError();
  }
}

type MoveBatch = Readonly<{
  sessionId: SessionId;
  moves: readonly TutorMove[];
}>;

async function startOrResume(
  input: Parameters<typeof createHttpTutorSource>[0],
  signal?: AbortSignal,
): Promise<MoveBatch> {
  const current = await retryRead(() => input.api.current(signal));
  if (current !== null) return { sessionId: current.session.sessionId, moves: current.moves };
  const created = await input.api.create(
    {
      subject: input.subject,
      grade: input.grade,
      fromRecommendation: input.fromRecommendation,
      ...(input.arrivalId === undefined ? {} : { arrivalId: input.arrivalId }),
      ...(input.checkIn === undefined ? {} : { checkIn: input.checkIn }),
    },
    signal,
  );
  return { sessionId: created.session.sessionId, moves: created.moves };
}

async function sendTurn(
  api: SessionApi,
  sessionId: MoveBatch['sessionId'],
  event: TutorInputEvent,
  signal?: AbortSignal,
): Promise<MoveBatch> {
  const response = await api.turn(
    { protocolVersion: PROTOCOL_VERSION, sessionId, event: { ...event, sessionId } },
    signal,
  );
  return { sessionId: response.sessionId, moves: response.moves };
}

function requireSessionId(value: MoveBatch['sessionId'] | null): MoveBatch['sessionId'] {
  if (value === null) throw new Error('Tutor session has not started');
  return value;
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}
