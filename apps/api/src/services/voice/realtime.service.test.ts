import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema, type TutorMove } from '@aria/shared';

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

function service(consent: 'granted' | 'missing', latestMove?: TutorMove) {
  const enqueueIfOpen = vi.fn(() => Promise.resolve());
  const realtime = createRealtimeService({
    sessions: { findById: () => Promise.resolve(session) },
    consent: {
      findGranted: () =>
        Promise.resolve(
          consent === 'missing'
            ? null
            : {
                id: 'c-1',
                parentId: 'p-1',
                studentId: 'student-1',
                status: 'granted',
                processorCategories: ['media', 'stt', 'tts'],
                retainReadingAudio: false,
                verificationReference: 'verified-check-1',
                verifiedAt: new Date(),
                withdrawnAt: null,
              },
        ),
    },
    voiceSessions: { open: () => Promise.resolve(2) },
    events: {
      list: () =>
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
        ),
    },
    outbox: { enqueueIfOpen },
    tokens: { mint: vi.fn(() => Promise.resolve('short-lived-token')) },
    clock: { now: () => new Date('2026-08-24T00:00:00Z') },
    livekitUrl: 'wss://voice.example.test',
    region: 'us-west',
    processors: { media: 'LiveKit', stt: 'configured STT', tts: 'configured TTS' },
  });
  return { realtime, enqueueIfOpen };
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
      room: 'aria_session-1',
      connectionEpoch: 2,
      expiresAt: '2026-08-24T00:05:00.000Z',
    });
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
});
