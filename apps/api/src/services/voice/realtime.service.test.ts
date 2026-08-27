import { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

import type { Queryable } from '@/db/types';
import type { TutorSessionRecord } from '@/types/session';

import { createRealtimeService } from './realtime.service';

const session: TutorSessionRecord = {
  id: 'session-1',
  studentId: 'student-1',
  subject: 'math',
  grade: '1',
  band: 'early',
  startedAt: new Date(),
  endedAt: null,
  endReason: null,
  plan: {},
  summary: null,
};
const transactionDb: Queryable = new Pool();

function service(
  consent: 'granted' | 'missing',
  latestMove?: TutorMove,
  overrides: Readonly<{
    rotate?: () => Promise<{
      previousEpoch: number | null;
      connectionEpoch: number;
    } | null>;
    mint?: () => Promise<string>;
    exclusive?: <T>(studentId: string, operation: (db: Queryable) => Promise<T>) => Promise<T>;
    pronunciation?: Readonly<Record<string, string>>;
  }> = {},
) {
  const enqueueIfOpen = vi.fn(() => Promise.resolve());
  const closeRoom = vi.fn(() => Promise.resolve());
  const mint = vi.fn(overrides.mint ?? (() => Promise.resolve('short-lived-token')));
  const findGranted = () =>
    Promise.resolve(
      consent === 'missing'
        ? null
        : {
            id: 'c-1',
            parentId: 'p-1',
            studentId: 'student-1',
            status: 'granted' as const,
            processorCategories: ['media', 'stt', 'tts'],
            retainReadingAudio: false,
            verificationReference: 'verified-check-1',
            grantedBy: null,
            processorMapVersion: null,
            verifiedAt: new Date(),
            withdrawnAt: null,
          },
    );
  const rotate =
    overrides.rotate ?? (() => Promise.resolve({ previousEpoch: 1, connectionEpoch: 2 }));
  const list = () =>
    Promise.resolve(
      latestMove === undefined
        ? []
        : [
            {
              id: 'event-1',
              sessionId: session.id,
              seq: 1,
              at: new Date(),
              actor: 'aria' as const,
              kind: latestMove.kind,
              text: latestMove.speech?.text ?? null,
              skillCode: null,
              correct: null,
              latencyMs: null,
              evidence: {},
              payload: latestMove,
            },
          ],
    );
  const realtime = createRealtimeService({
    sessions: { findById: () => Promise.resolve(session) },
    consent: {
      findGranted,
      withDb: () => ({ findGranted }),
    },
    voiceSessions: {
      rotate,
      withDb: () => ({ rotate }),
    },
    lifecycle: {
      exclusive:
        overrides.exclusive ??
        (<T>(_studentId: string, operation: (db: Queryable) => Promise<T>) =>
          operation(transactionDb)),
    },
    events: {
      list,
      withDb: () => ({ list }),
    },
    outbox: { enqueueIfOpen, withDb: () => ({ enqueueIfOpen }) },
    rooms: { close: closeRoom },
    tokens: { mint },
    pronunciation: {
      forStudent: () => Promise.resolve(overrides.pronunciation ?? {}),
    },
    clock: { now: () => new Date('2026-08-24T00:00:00Z') },
    livekitUrl: 'wss://voice.example.test',
    region: 'us-west',
    processors: { media: 'LiveKit', stt: 'configured STT', tts: 'configured TTS' },
  });
  return { realtime, enqueueIfOpen, closeRoom, mint };
}

describe('realtime negotiation', () => {
  it('refuses media credentials without separate verified voice consent', async () => {
    await expect(service('missing').realtime.negotiate('student-1', 'session-1')).rejects.toThrow(
      /voice consent/,
    );
  });

  it('mints a five-minute room credential and records a new connection epoch', async () => {
    await expect(
      service('granted').realtime.negotiate('student-1', 'session-1'),
    ).resolves.toMatchObject({
      token: 'short-lived-token',
      room: 'aria_session-1_2',
      connectionEpoch: 2,
      expiresAt: '2026-08-24T00:05:00.000Z',
    });
  });

  it('closes the previous room before minting reconnect credentials', async () => {
    const current = service('granted');

    await current.realtime.negotiate('student-1', 'session-1');

    expect(current.closeRoom).toHaveBeenCalledWith('aria_session-1_1');
    expect(current.closeRoom.mock.invocationCallOrder[0]).toBeLessThan(
      current.mint.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('puts the current gated move in the outbox when voice joins mid-session', async () => {
    const move = tutorMoveSchema.parse({
      id: 'move-1',
      at: '2026-08-24T00:00:00.000Z',
      protocolVersion: PROTOCOL_VERSION,
      sessionId: 'session-1',
      kind: 'SAY',
      speech: { text: 'Let us try.' },
      display: [],
      expects: 'none',
    });
    const current = service('granted', move);

    await current.realtime.negotiate('student-1', 'session-1');

    expect(current.enqueueIfOpen).toHaveBeenCalledWith('session-1', move);
  });

  it('refuses credentials when the session ends before the locked rotation', async () => {
    const current = service('granted', undefined, { rotate: () => Promise.resolve(null) });

    await expect(current.realtime.negotiate('student-1', 'session-1')).rejects.toThrow(
      /already ended/,
    );
    expect(current.mint).not.toHaveBeenCalled();
  });

  it('serializes simultaneous reconnects so each returned epoch is current when issued', async () => {
    let tail = Promise.resolve();
    const exclusive = async <T>(
      _studentId: string,
      operation: (db: Queryable) => Promise<T>,
    ): Promise<T> => {
      const previous = tail;
      let release = (): void => undefined;
      tail = new Promise<void>((resolve) => {
        release = resolve;
      });
      await previous;
      try {
        return await operation(transactionDb);
      } finally {
        release();
      }
    };
    let epoch = 1;
    const rotate = vi.fn(() => {
      const previousEpoch = epoch;
      epoch += 1;
      return Promise.resolve({ previousEpoch, connectionEpoch: epoch });
    });
    const current = service('granted', undefined, { rotate, exclusive });

    const [first, second] = await Promise.all([
      current.realtime.negotiate('student-1', 'session-1'),
      current.realtime.negotiate('student-1', 'session-1'),
    ]);

    expect([first.connectionEpoch, second.connectionEpoch]).toEqual([2, 3]);
    expect(current.closeRoom).toHaveBeenNthCalledWith(1, 'aria_session-1_1');
    expect(current.closeRoom).toHaveBeenNthCalledWith(2, 'aria_session-1_2');
  });

  it('mints the profile pronunciation into the participant token (P2H-08)', async () => {
    const current = service('granted', undefined, { pronunciation: { Siobhan: 'shiv-AWN' } });

    await current.realtime.negotiate('student-1', 'session-1');

    expect(current.mint).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: {
          sessionId: 'session-1',
          connectionEpoch: 2,
          band: 'early',
          pronunciation: JSON.stringify({ Siobhan: 'shiv-AWN' }),
        },
      }),
    );
  });

  it('sends no pronunciation field at all when the profile has nothing to say', async () => {
    const current = service('granted');

    await current.realtime.negotiate('student-1', 'session-1');

    expect(current.mint).toHaveBeenCalledWith(
      expect.objectContaining({
        // Exact, not partial: the field is absent, not present and empty.
        metadata: { sessionId: 'session-1', connectionEpoch: 2, band: 'early' },
      }),
    );
  });
});
