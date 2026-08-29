import {
  PROTOCOL_VERSION,
  type Grade,
  type SessionId,
  type TurnRequest,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';

import { ApiError } from '@/api/errors';
import type { SessionApi } from '@/features/session/api/session.api';
import { ContentUnavailableError, TurnRejectedError } from '@/features/session/model/tutor-source';
import type { TutorOutput, TutorSource } from '@/features/session/model/tutor-source';

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
      if (event.kind !== 'SUBJECT_CHOSEN') {
        yield* streamed(sendTurn(input.api, requireSessionId(sessionId), event, signal), signal, {
          isClosed,
        });
        return;
      }
      const batch = await recoverable(startOrResume(input, signal), signal);
      if (batch === null) return;
      sessionId = batch.sessionId;
      input.onSessionStarted?.(batch.sessionId);
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

/**
 * A failed stream is the same failure a failed POST was: content is unavailable, retry later —
 * unless the API answered and refused, which is a rejected turn and not an outage.
 */
async function* streamed(
  turn: AsyncIterable<TutorOutput>,
  signal: AbortSignal | undefined,
  session: Readonly<{ isClosed(): boolean }>,
): AsyncIterable<TutorOutput> {
  const iterator = turn[Symbol.asyncIterator]();
  for (;;) {
    let next: IteratorResult<TutorOutput>;
    try {
      next = await iterator.next();
    } catch (error) {
      if (isAborted(signal)) return;
      throw sourceError(error);
    }
    if (next.done === true) return;
    if (session.isClosed() || isAborted(signal)) return;
    yield next.value;
  }
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

/**
 * A class pick always goes to `create`. The API decides whether that resumes an open session
 * for the same class or ends a stale one and starts fresh — the browser used to make that
 * call itself from `current()`, and resumed whatever was left open, so a child who picked a
 * new class answered yesterday's question and was told it did not match.
 */
async function startOrResume(
  input: Parameters<typeof createHttpTutorSource>[0],
  signal?: AbortSignal,
): Promise<MoveBatch> {
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

/**
 * P2H-07: reads a turn as it is written.
 *
 * Each sentence is rendered the moment it arrives, and the closing frame carries the moves —
 * which is what actually decides what the child is asked to do next. A stream that ends without
 * that frame failed partway through, and is reported as a turn that produced nothing.
 */
async function* sendTurn(
  api: SessionApi,
  sessionId: MoveBatch['sessionId'],
  event: TutorInputEvent,
  signal?: AbortSignal,
): AsyncIterable<TutorOutput> {
  const request: TurnRequest = {
    protocolVersion: PROTOCOL_VERSION,
    sessionId,
    event: { ...event, sessionId },
  };
  let closed = false;
  for await (const frame of api.turnStream(request, signal)) {
    if (frame.kind === 'MOVE_SEGMENT') {
      yield frame;
      continue;
    }
    closed = true;
    yield* frame.turn.moves;
  }
  if (!closed) throw new ContentUnavailableError();
}

function sourceError(error: unknown): Error {
  if (error instanceof ContentUnavailableError || error instanceof TurnRejectedError) return error;
  if (error instanceof ApiError && error.kind === 'http' && isClientRejection(error.status)) {
    return new TurnRejectedError(error.code);
  }
  return new ContentUnavailableError();
}

function isClientRejection(status: number | undefined): boolean {
  return status !== undefined && status >= 400 && status < 500 && status !== 429;
}

function requireSessionId(value: MoveBatch['sessionId'] | null): MoveBatch['sessionId'] {
  if (value === null) throw new Error('Tutor session has not started');
  return value;
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted ?? false;
}
