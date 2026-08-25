import { describe, expect, it, vi } from 'vitest';

import { PROTOCOL_VERSION, tutorMoveSchema } from '@aria/shared';

import type { SessionEventRecord, TutorSessionRecord } from '@/types/session';

import { createWorkerTurnService } from './worker-turn.service';

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

const move = tutorMoveSchema.parse({
  id: 'move-2',
  at: '2026-08-24T00:00:00.000Z',
  protocolVersion: PROTOCOL_VERSION,
  sessionId: 'session-1',
  serverSeq: 2,
  generationId: 'generation-2',
  kind: 'SAY',
  speech: { text: 'Let us try.' },
  display: [],
  expects: 'none',
});

const storedEvent: SessionEventRecord = {
  id: 'stored-event-1',
  sessionId: 'session-1',
  seq: 1,
  at: new Date('2026-08-24T00:00:00.000Z'),
  actor: 'child',
  kind: 'BACKCHANNEL',
  text: null,
  skillCode: null,
  correct: null,
  latencyMs: null,
  evidence: {},
  payload: {},
};

const eventWriter = () => vi.fn(() => Promise.resolve(storedEvent));

describe('voice worker turn delivery', () => {
  it('replays all moves after the acknowledged cursor in server order', async () => {
    const turn = vi.fn(() => Promise.resolve());
    const service = createWorkerTurnService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 3 }) },
      outbox: {
        acknowledge: () => Promise.resolve(),
        listAfter: () => Promise.resolve([{ serverSeq: 2, move }]),
      },
      events: { append: eventWriter() },
      turn,
      clock: { now: () => new Date('2026-08-24T00:00:00Z') },
    });
    const response = await service.handle('session-1', {
      protocolVersion: PROTOCOL_VERSION,
      connectionEpoch: 3,
      acknowledgedSeq: 1,
      replayOnly: false,
      authorizeOnly: false,
      event: {
        id: 'event-2',
        at: '2026-08-24T00:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
        kind: 'SPEECH_FINAL',
        text: 'seven',
        confidence: 0.9,
      },
    });
    expect(response.moves).toEqual([move]);
    expect(turn).toHaveBeenCalledOnce();
  });

  it('replays after a worker restart without creating a second tutor turn', async () => {
    const turn = vi.fn(() => Promise.resolve());
    const service = createWorkerTurnService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 3 }) },
      outbox: {
        acknowledge: () => Promise.resolve(),
        listAfter: () => Promise.resolve([{ serverSeq: 2, move }]),
      },
      events: { append: eventWriter() },
      turn,
      clock: { now: () => new Date('2026-08-24T00:00:00Z') },
    });

    const response = await service.handle('session-1', {
      protocolVersion: PROTOCOL_VERSION,
      connectionEpoch: 3,
      acknowledgedSeq: 1,
      replayOnly: true,
      authorizeOnly: false,
      event: {
        id: 'resume-2',
        at: '2026-08-24T00:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
        kind: 'RESUME',
      },
    });

    expect(response.moves).toEqual([move]);
    expect(turn).not.toHaveBeenCalled();
  });

  it('authorizes a reconnect without loading a long move history', async () => {
    const turn = vi.fn(() => Promise.resolve());
    const listAfter = vi.fn(() =>
      Promise.resolve(
        Array.from({ length: 129 }, (_, index) => ({
          serverSeq: index + 1,
          move: { ...move, id: `move-${String(index + 1)}`, serverSeq: index + 1 },
        })),
      ),
    );
    const service = createWorkerTurnService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 3 }) },
      outbox: { acknowledge: () => Promise.resolve(), listAfter },
      events: { append: eventWriter() },
      turn,
      clock: { now: () => new Date('2026-08-24T00:00:00Z') },
    });

    const response = await service.handle('session-1', {
      protocolVersion: PROTOCOL_VERSION,
      connectionEpoch: 3,
      acknowledgedSeq: 0,
      replayOnly: true,
      authorizeOnly: true,
      event: {
        id: 'authorize-3',
        at: '2026-08-24T00:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
        kind: 'RESUME',
      },
    });

    expect(response.moves).toEqual([]);
    expect(listAfter).not.toHaveBeenCalled();
    expect(turn).not.toHaveBeenCalled();
  });

  it('drops a stale connection epoch before the tutor can commit a turn', async () => {
    const turn = vi.fn(() => Promise.resolve());
    const service = createWorkerTurnService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 4 }) },
      outbox: { acknowledge: () => Promise.resolve(), listAfter: () => Promise.resolve([]) },
      events: { append: eventWriter() },
      turn,
      clock: { now: () => new Date() },
    });
    await expect(
      service.handle('session-1', {
        protocolVersion: PROTOCOL_VERSION,
        connectionEpoch: 3,
        acknowledgedSeq: 1,
        replayOnly: false,
        authorizeOnly: false,
        event: {
          id: 'e',
          at: '2026-08-24T00:00:00.000Z',
          protocolVersion: PROTOCOL_VERSION,
          kind: 'MEDIA_RESTORED',
        },
      }),
    ).rejects.toThrow(/stale voice connection epoch/);
    expect(turn).not.toHaveBeenCalled();
  });

  it('records a backchannel without asking the tutor to generate a reply', async () => {
    const turn = vi.fn(() => Promise.resolve());
    const append = eventWriter();
    const service = createWorkerTurnService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 3 }) },
      outbox: { acknowledge: () => Promise.resolve(), listAfter: () => Promise.resolve([]) },
      events: { append },
      turn,
      clock: { now: () => new Date('2026-08-24T00:00:00Z') },
    });

    await service.handle('session-1', {
      protocolVersion: PROTOCOL_VERSION,
      connectionEpoch: 3,
      acknowledgedSeq: 1,
      replayOnly: false,
      authorizeOnly: false,
      event: {
        id: 'backchannel-1',
        at: '2026-08-24T00:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
        kind: 'BACKCHANNEL',
      },
    });

    expect(append).toHaveBeenCalledOnce();
    expect(turn).not.toHaveBeenCalled();
  });

  it('records how far into an interrupted answer the child actually got', async () => {
    const append = eventWriter();
    const service = createWorkerTurnService({
      sessions: { findById: () => Promise.resolve(session) },
      voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 3 }) },
      outbox: { acknowledge: () => Promise.resolve(), listAfter: () => Promise.resolve([]) },
      events: { append },
      turn: vi.fn(() => Promise.resolve()),
      clock: { now: () => new Date('2026-08-24T00:00:00Z') },
    });

    await service.handle('session-1', {
      protocolVersion: PROTOCOL_VERSION,
      connectionEpoch: 3,
      acknowledgedSeq: 1,
      replayOnly: false,
      authorizeOnly: false,
      // P2H-07: the child talked over Aria after the second sentence — index 1 of 0,1,2,…
      spokenPrefix: { generationId: 'generation-1', index: 1 },
      event: {
        id: 'speech-started-1',
        at: '2026-08-24T00:00:00.000Z',
        protocolVersion: PROTOCOL_VERSION,
        kind: 'SPEECH_STARTED',
      },
    });

    expect(append).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'SPEECH_STARTED',
        // Two sentences were heard, so that is what the transcript records.
        evidence: { generationId: 'generation-1', truncatedAt: 2 },
      }),
    );
  });
});
