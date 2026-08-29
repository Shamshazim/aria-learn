import { describe, expect, it, vi } from 'vitest';

import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  tutorInputEventSchema,
  tutorMoveSchema,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';

import { ApiError } from '@/api/errors';
import type { SessionApi } from '@/features/session/api/session.api';
import {
  ContentUnavailableError,
  isTutorMove,
  TurnRejectedError,
} from '@/features/session/model/tutor-source';
import { createHttpTutorSource } from '@/features/session/sources/http-source';

const SESSION_ID = sessionIdSchema.parse('11111111-1111-4111-8111-111111111111');

describe('HTTP tutor source', () => {
  it('creates once, forwards later turns and preserves server moves', async () => {
    const ask = move('ASK', 'What is four plus three?');
    const hint = move('HINT', 'Start at four.');
    const api = fakeApi({ createdMoves: [ask], turnMoves: [hint] });
    const source = createHttpTutorSource({
      api,
      grade: '4',
      subject: 'math',
      fromRecommendation: false,
      checkIn: 'challenge',
    });

    await expect(
      collect(
        source,
        event({ kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '4', fromRecommendation: false }),
      ),
    ).resolves.toEqual([ask]);
    await expect(
      collect(source, event({ kind: 'ANSWER', respondsTo: ask.id, text: '6' })),
    ).resolves.toEqual([hint]);

    expect(api.create).toHaveBeenCalledWith(
      expect.objectContaining({ checkIn: 'challenge' }),
      undefined,
    );
    const turnCall = vi.mocked(api.turn).mock.calls[0];
    expect(turnCall?.[0]).toMatchObject({
      sessionId: SESSION_ID,
      event: { sessionId: SESSION_ID },
    });
  });

  it('yields each sentence as it arrives, then the moves that close the turn', async () => {
    const hint = move('HINT', 'Start at four.');
    const api = fakeApi({ createdMoves: [], turnMoves: [hint] });
    const streamed = {
      kind: 'MOVE_SEGMENT' as const,
      generationId: 'gen-1',
      moveId: hint.id,
      index: 0,
      text: 'Start at four.',
      speech: 'Start at four.',
      isLast: false,
    };
    const source = await startedSource({
      ...api,
      turnStream: async function* (request: Parameters<SessionApi['turn']>[0]) {
        yield await Promise.resolve(streamed);
        yield { kind: 'TURN_MOVES' as const, turn: await api.turn(request, undefined) };
      },
    });

    const output: unknown[] = [];
    for await (const item of source.send(event({ kind: 'CONFUSED' }))) output.push(item);

    expect(output).toEqual([streamed, hint]);
  });

  it('treats a turn that stopped mid-sentence as content that is unavailable', async () => {
    const api = fakeApi({ createdMoves: [], turnMoves: [] });
    const source = await startedSource({
      ...api,
      // The stream ends without its closing frame: the turn stopped part-way through.
      turnStream: async function* () {
        yield await Promise.resolve({
          kind: 'MOVE_SEGMENT' as const,
          generationId: 'gen-1',
          moveId: 'move-1',
          index: 0,
          text: 'Start at',
          speech: 'Start at',
          isLast: false,
        });
      },
    });

    await expect(collect(source, event({ kind: 'CONFUSED' }))).rejects.toBeInstanceOf(
      ContentUnavailableError,
    );
  });

  it('reports a turn the API refused as rejected, not as content that is unavailable', async () => {
    const api = fakeApi({ createdMoves: [], turnMoves: [] });
    const source = await startedSource({
      ...api,
      // eslint-disable-next-line require-yield -- the API answered 400 before any frame.
      turnStream: async function* () {
        await Promise.resolve();
        throw new ApiError('http', 'VALIDATION_ERROR', 400);
      },
    });

    const failure = collect(source, event({ kind: 'ANSWER', respondsTo: 'ask-old', text: '7' }));
    await expect(failure).rejects.toBeInstanceOf(TurnRejectedError);
    await expect(failure).rejects.toMatchObject({ code: 'VALIDATION_ERROR' });
  });

  it('still treats a server failure as content that is unavailable', async () => {
    const api = fakeApi({ createdMoves: [], turnMoves: [] });
    const source = await startedSource({
      ...api,
      // eslint-disable-next-line require-yield -- the API fell over before any frame.
      turnStream: async function* () {
        await Promise.resolve();
        throw new ApiError('http', 'SERVICE_UNAVAILABLE', 503);
      },
    });

    await expect(collect(source, event({ kind: 'CONFUSED' }))).rejects.toBeInstanceOf(
      ContentUnavailableError,
    );
  });

  it('lets the API decide between resume and fresh on a class pick', async () => {
    const resumed = move('ASK', 'Keep going.');
    const api = fakeApi({ createdMoves: [resumed], turnMoves: [] });
    vi.mocked(api.current).mockResolvedValue({
      session: sessionContext(),
      moves: [move('ASK', 'Yesterday.')],
      lastAppliedSeq: 4,
    });
    const source = createHttpTutorSource({
      api,
      grade: '4',
      subject: 'math',
      fromRecommendation: false,
    });

    await expect(
      collect(
        source,
        event({ kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '4', fromRecommendation: false }),
      ),
    ).resolves.toEqual([resumed]);
    expect(api.create).toHaveBeenCalledTimes(1);
    expect(api.current).not.toHaveBeenCalled();
  });
});

function fakeApi(
  input: Readonly<{
    createdMoves: readonly TutorMove[];
    turnMoves: readonly TutorMove[];
  }>,
): SessionApi {
  const current = vi.fn<SessionApi['current']>(() => Promise.resolve(null));
  const create = vi.fn<SessionApi['create']>(() =>
    Promise.resolve({
      session: sessionContext(),
      moves: [...input.createdMoves],
      resumed: false,
    }),
  );
  const turn = vi.fn<SessionApi['turn']>((request) =>
    Promise.resolve({
      protocolVersion: PROTOCOL_VERSION,
      sessionId: SESSION_ID,
      inResponseTo: request.event.id,
      at: '2026-08-24T20:00:00.000Z',
      moves: [...input.turnMoves],
    }),
  );
  const end = vi.fn<SessionApi['end']>(() =>
    Promise.resolve({
      sessionId: SESSION_ID,
      endedAt: '2026-08-24T20:10:00.000Z',
      reason: 'complete',
    }),
  );
  return {
    current,
    create,
    turn,
    // P2H-07: the buffered answer, delivered as a stream with nothing but its closing frame.
    turnStream: async function* (input: Parameters<SessionApi['turn']>[0], signal?: AbortSignal) {
      yield { kind: 'TURN_MOVES' as const, turn: await turn(input, signal) };
    },
    end,
    realtime: vi.fn<SessionApi['realtime']>(() => Promise.reject(new Error('not used'))),
  };
}

/** A source that has already created its session, so the next event is an ordinary turn. */
async function startedSource(api: SessionApi) {
  const source = createHttpTutorSource({
    api,
    grade: '4',
    subject: 'math',
    fromRecommendation: false,
  });
  await collect(
    source,
    event({ kind: 'SUBJECT_CHOSEN', subjectId: 'math', grade: '4', fromRecommendation: false }),
  );
  return source;
}

function sessionContext() {
  return {
    sessionId: SESSION_ID,
    subjectId: 'math',
    grade: '4' as const,
    band: 'middle' as const,
    startedAt: '2026-08-24T20:00:00.000Z',
  };
}

function move(kind: 'ASK' | 'HINT', text: string): TutorMove {
  return tutorMoveSchema.parse({
    id: `move-${kind}`,
    at: '2026-08-24T20:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    sessionId: SESSION_ID,
    kind,
    speech: { text },
    display: [],
    expects: 'none',
    ...(kind === 'ASK' ? { itemId: 'item-1' } : { attempt: 1 }),
  });
}

function event(input: Readonly<Record<string, unknown>>): TutorInputEvent {
  return tutorInputEventSchema.parse({
    id: `event-${String(input.kind)}`,
    at: '2026-08-24T20:00:00.000Z',
    protocolVersion: PROTOCOL_VERSION,
    ...input,
  });
}

async function collect(
  source: ReturnType<typeof createHttpTutorSource>,
  input: TutorInputEvent,
): Promise<readonly TutorMove[]> {
  const result: TutorMove[] = [];
  for await (const item of source.send(input)) if (isTutorMove(item)) result.push(item);
  return result;
}
