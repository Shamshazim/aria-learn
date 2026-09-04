import { describe, expect, it, vi } from 'vitest';

import type { NewSessionEvent, SessionEventRecord, TutorSessionRecord } from '@/types/session';

import { createTalkEventsService } from './talk-events.service';

const NOW = new Date('2026-08-28T10:10:00.000Z');

const session: TutorSessionRecord = {
  id: 'session-1',
  studentId: 'student-1',
  subject: 'mathematics',
  grade: '4',
  band: 'middle',
  startedAt: NOW,
  endedAt: null,
  endReason: null,
  plan: {},
  summary: null,
};

function service(safe: boolean) {
  const appended: NewSessionEvent[] = [];
  const events = createTalkEventsService({
    sessions: { findById: () => Promise.resolve(session) },
    voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 2 }) },
    events: {
      append: vi.fn((input: NewSessionEvent) => {
        appended.push(input);
        return Promise.resolve({ ...input, id: 'e', seq: appended.length, at: NOW } as SessionEventRecord);
      }),
    },
    safety: {
      check: () =>
        Promise.resolve(
          safe ? { safe: true } : { safe: false, response: 'I am here with you.', needsReview: false },
        ),
    },
    clock: { now: () => NOW },
  });
  return { events, appended };
}

describe('the transcript of a session where Aria talks', () => {
  it("records the child's words as the pipeline would, with no crisis", async () => {
    const { events, appended } = service(true);

    await expect(events.heard('session-1', 2, 'four hundred seventy')).resolves.toEqual({
      crisis: null,
    });
    expect(appended).toEqual([
      expect.objectContaining({ actor: 'child', kind: 'SPEECH_FINAL', text: 'four hundred seventy' }),
    ]);
  });

  it('records what the child typed on the screen as words Aria heard, marked as typed', async () => {
    const { events, appended } = service(true);
    await events.heard('session-1', 2, 'My cat is called Pickle.', 'screen');
    expect(appended[0]?.payload).toEqual({ source: 'screen', text: 'My cat is called Pickle.' });
    expect(appended[0]?.kind).toBe('SPEECH_FINAL');
  });

  it('returns the fixed crisis line and marks the record when the child discloses', async () => {
    const { events, appended } = service(false);

    await expect(events.heard('session-1', 2, 'I want to hurt myself')).resolves.toEqual({
      crisis: { say: 'I am here with you.' },
    });
    expect(appended[0]?.evidence).toEqual({ safety: 'crisis' });
  });

  it("records Aria's own words and flags unsafe speech", async () => {
    const { events, appended } = service(true);

    await expect(events.spoken('session-1', 2, 'Nice work on the tens.')).resolves.toEqual({
      verdict: 'ok',
    });
    await expect(events.spoken('session-1', 2, 'Never touch a weapon.')).resolves.toEqual({
      verdict: 'unsafe',
    });
    expect(appended.map((item) => [item.actor, item.kind, item.evidence])).toEqual([
      ['aria', 'SPOKEN', {}],
      ['aria', 'SPOKEN', { safety: 'unsafe_output' }],
    ]);
  });

  it('refuses a stale connection epoch', async () => {
    const { events } = service(true);
    await expect(events.spoken('session-1', 3, 'hi')).rejects.toThrow(/stale/);
  });
});
