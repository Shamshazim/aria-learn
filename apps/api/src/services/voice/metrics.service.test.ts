import { describe, expect, it, vi } from 'vitest';

import type { SessionEventRecord, TutorSessionRecord } from '@/types/session';

import { createVoiceMetricsService } from './metrics.service';

const session: TutorSessionRecord = {
  id: 'session-1',
  studentId: 'student-1',
  subject: 'math',
  grade: '1',
  band: 'early',
  startedAt: new Date('2026-08-24T00:00:00.000Z'),
  endedAt: null,
  endReason: null,
  plan: {},
  summary: null,
};

const storedEvent: SessionEventRecord = {
  id: 'event-1',
  sessionId: 'session-1',
  seq: 1,
  at: new Date('2026-08-24T00:00:00.000Z'),
  actor: 'system',
  kind: 'VOICE_METRIC',
  text: null,
  skillCode: null,
  correct: null,
  latencyMs: 95,
  evidence: {},
  payload: {},
};

describe('voice metrics service', () => {
  it('records a bounded named span without transcript or audio content', async () => {
    const append = vi.fn(() => Promise.resolve(storedEvent));
    const service = createVoiceMetricsService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 2 }) },
      events: { append },
      clock: { now: () => new Date('2026-08-24T00:00:00.000Z') },
    });

    await service.record('session-1', {
      connectionEpoch: 2,
      metric: { kind: 'tts', ttfbMs: 95.6, durationMs: 340, cancelled: false },
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'VOICE_METRIC', latencyMs: 96, text: null }),
    );
  });

  it('drops stale-worker metrics', async () => {
    const append = vi.fn(() => Promise.resolve(storedEvent));
    const service = createVoiceMetricsService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 3 }) },
      events: { append },
      clock: { now: () => new Date() },
    });

    await expect(
      service.record('session-1', {
        connectionEpoch: 2,
        metric: { kind: 'stt', audioDurationMs: 500 },
      }),
    ).rejects.toThrow(/stale voice connection epoch/);
    expect(append).not.toHaveBeenCalled();
  });
});
