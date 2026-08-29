import { describe, expect, it } from 'vitest';

import { PROTOCOL_VERSION, type Skill } from '@aria/shared';

import { scrubLearnerContext } from '@/privacy';
import type { SessionEventRecord, TutorSessionRecord } from '@/types/session';
import type { Student } from '@/types/student';

import { createTalkBriefService } from './talk-brief.service';

const NOW = new Date('2026-08-28T10:10:00.000Z');

const session: TutorSessionRecord = {
  id: 'session-1',
  studentId: 'student-1',
  subject: 'mathematics',
  grade: '4',
  band: 'middle',
  startedAt: new Date('2026-08-28T10:00:00.000Z'),
  endedAt: null,
  endReason: null,
  plan: { skillCode: 'MATH.G4.U01.L02.T03' },
  summary: null,
};

const askRecord: SessionEventRecord = {
  id: 'event-ask',
  sessionId: 'session-1',
  seq: 3,
  at: NOW,
  actor: 'aria',
  kind: 'ASK',
  text: 'Round 468 to the nearest ten.',
  skillCode: 'MATH.G4.U01.L02.T03',
  correct: null,
  latencyMs: null,
  evidence: { answerKey: '470' },
  payload: {
    id: 'ask-1',
    at: NOW.toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    sessionId: 'session-1',
    kind: 'ASK',
    itemId: 'item-1',
    speech: { text: 'Round 468 to the nearest ten.' },
    display: [
      {
        type: 'choices',
        options: [
          { id: 'a', label: '460' },
          { id: 'b', label: '470' },
        ],
      },
    ],
    expects: 'choice',
  },
};

const STUDENT: Student = {
  id: 'student-1',
  parentId: 'parent-1',
  displayName: 'Sam Rivera',
  grade: '4',
  band: 'middle',
  settings: { shareFirstName: true, pronunciation: null, avatar: 'fox' },
  createdAt: NOW,
};

const SKILL: Skill = {
  id: 'skill-math-g4-u01-l02-t03',
  subject: 'mathematics',
  strand: 'Place value',
  code: 'MATH.G4.U01.L02.T03',
  name: 'Rounding to tens and hundreds',
  band: 'middle',
  prerequisites: [],
  lessonRef: null,
  visualKinds: [],
  grade: '4',
  unit: 'Place value',
  lesson: 'Rounding',
  objectives: ['Round to the nearest ten', 'Round to the nearest hundred'],
};

function service(overrides: Partial<Parameters<typeof createTalkBriefService>[0]> = {}) {
  return createTalkBriefService({
    sessions: { findById: () => Promise.resolve(session) },
    voiceSessions: { findOpen: () => Promise.resolve({ connectionEpoch: 2 }) },
    events: { list: () => Promise.resolve([askRecord]) },
    students: { requireById: () => Promise.resolve(STUDENT) },
    inventory: {
      getSkill: (code) => (code === SKILL.code ? SKILL : null),
      getLesson: () => null,
    },
    retrieve: () =>
      Promise.resolve({
        context: scrubLearnerContext(
          {
            identifiers: { fullName: 'Sam Rivera' },
            gradeBand: 'middle',
            pseudonymousFirstName: 'Sam',
            learnerMemory: [{ category: 'interest', modelShareable: true, text: 'Likes frogs.' }],
          },
          { pseudonym: 'include' },
        ),
        estimatedTokens: 10,
        factIds: ['fact-1'],
      }),
    sessionLimitMinutes: () => 20,
    clock: { now: () => NOW },
    ...overrides,
  });
}

describe('the brief the realtime model teaches from', () => {
  it('carries the skill, the open question with its key and choices, memory and time left', async () => {
    const brief = await service().brief('session-1', 2);

    expect(brief).toMatchObject({
      connectionEpoch: 2,
      student: { firstName: 'Sam', grade: '4', band: 'middle' },
      subject: 'mathematics',
      skill: { name: 'Rounding to tens and hundreds', unit: 'Place value' },
      note: null,
      openQuestion: {
        id: 'ask-1',
        prompt: 'Round 468 to the nearest ten.',
        answerKey: '470',
        options: [
          { id: 'a', text: '460' },
          { id: 'b', text: '470' },
        ],
      },
      memory: ['Likes frogs.'],
      minutesLeft: 10,
    });
  });

  it('has no question and no skill when the session has neither yet', async () => {
    const brief = await service({
      sessions: { findById: () => Promise.resolve({ ...session, plan: {} }) },
      events: { list: () => Promise.resolve([]) },
    }).brief('session-1', 2);

    expect(brief.skill).toBeNull();
    expect(brief.openQuestion).toBeNull();
  });

  it('refuses a stale connection epoch', async () => {
    await expect(service().brief('session-1', 1)).rejects.toThrow(/stale/);
  });

  it('refuses a session that has ended', async () => {
    await expect(
      service({
        sessions: { findById: () => Promise.resolve({ ...session, endedAt: NOW }) },
      }).brief('session-1', 2),
    ).rejects.toThrow(/ended/);
  });
});
