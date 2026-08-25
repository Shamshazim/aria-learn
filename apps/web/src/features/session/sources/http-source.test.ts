import { describe, expect, it, vi } from 'vitest';

import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  tutorInputEventSchema,
  tutorMoveSchema,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';

import type { SessionApi } from '@/features/session/api/session.api';
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

  it('resumes an open session instead of creating another one', async () => {
    const resumed = move('ASK', 'Keep going.');
    const api = fakeApi({ createdMoves: [], turnMoves: [] });
    vi.mocked(api.current).mockResolvedValue({
      session: sessionContext(),
      moves: [resumed],
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
    expect(api.create).not.toHaveBeenCalled();
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
    end,
  };
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
  for await (const item of source.send(input)) result.push(item);
  return result;
}
