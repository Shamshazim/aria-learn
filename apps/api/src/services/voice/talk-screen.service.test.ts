import { describe, expect, it, vi } from 'vitest';

import type { TutorMove } from '@aria/shared';

import { fixedClock } from '@/lib/clock';
import { sequentialIds } from '@/lib/ids';
import type { NewSessionEvent, SessionEventRecord, TutorSessionRecord } from '@/types/session';

import { createTalkScreenService } from './talk-screen.service';

const NOW = new Date('2026-09-02T10:10:00.000Z');

const session: TutorSessionRecord = {
  id: 'session-1',
  studentId: 'student-1',
  subject: 'english',
  grade: '4',
  band: 'middle',
  startedAt: NOW,
  endedAt: null,
  endReason: null,
  plan: { skillCode: 'ELA.G4.U01.L01.T01' },
  summary: null,
};

function service() {
  const appended: NewSessionEvent[] = [];
  const enqueued: TutorMove[] = [];
  const screen = createTalkScreenService({
    sessions: { findById: () => Promise.resolve(session) },
    voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 2 }) },
    events: {
      append: vi.fn((input: NewSessionEvent) => {
        appended.push(input);
        return Promise.resolve({ ...input, id: 'e', seq: appended.length, at: NOW } as SessionEventRecord);
      }),
    },
    outbox: {
      enqueueIfOpen: (_sessionId, move) => {
        enqueued.push(move);
        return Promise.resolve({ ...move, serverSeq: 7 });
      },
    },
    ids: sequentialIds('move'),
    clock: fixedClock(NOW),
  });
  return { screen, appended, enqueued };
}

describe('the screen of a session where Aria talks', () => {
  it('opens a writing pad as a recorded SHOW move that expects text', async () => {
    const { screen, appended, enqueued } = service();

    const move = await screen.show('session-1', {
      connectionEpoch: 2,
      surface: 'writing',
      text: 'Write two sentences about your favourite animal.',
    });

    expect(move.kind).toBe('SHOW');
    expect(move.expects).toBe('text');
    expect(move.display).toEqual([
      { type: 'workpad', mode: 'answer', prompt: 'Write two sentences about your favourite animal.' },
    ]);
    expect(move.serverSeq).toBe(7);
    expect(move.speech).toBeNull();
    expect(appended).toEqual([
      expect.objectContaining({
        actor: 'aria',
        kind: 'SHOW',
        skillCode: 'ELA.G4.U01.L01.T01',
        evidence: { source: 'realtime', surface: 'writing' },
      }),
    ]);
    expect(enqueued).toHaveLength(1);
  });

  it('turns choices into tappable options with stable ids', async () => {
    const { screen } = service();
    const move = await screen.show('session-1', {
      connectionEpoch: 2,
      surface: 'choices',
      text: 'Which word is a noun?',
      options: ['run', 'apple', 'quickly'],
    });
    expect(move.expects).toBe('choice');
    expect(move.display).toEqual([
      { type: 'text', body: 'Which word is a noun?', markdown: false },
      {
        type: 'choices',
        options: [
          { id: 'a', label: 'run' },
          { id: 'b', label: 'apple' },
          { id: 'c', label: 'quickly' },
        ],
      },
    ]);
  });

  it('refuses choices without options, and clears with nothing to show', async () => {
    const { screen } = service();
    await expect(
      screen.show('session-1', { connectionEpoch: 2, surface: 'choices' }),
    ).rejects.toThrow(/options/);
    const cleared = await screen.show('session-1', { connectionEpoch: 2, surface: 'clear' });
    expect(cleared.display).toEqual([]);
    expect(cleared.expects).toBe('none');
  });

  it('refuses a stale connection epoch', async () => {
    const { screen } = service();
    await expect(
      screen.show('session-1', { connectionEpoch: 3, surface: 'clear' }),
    ).rejects.toThrow(/stale/);
  });
});
