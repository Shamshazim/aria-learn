import { describe, expect, it, vi } from 'vitest';

import { fixedClock } from '@/lib/clock';
import { createSessionService } from '@/services/session/session.service';
import type { TutorSessionRecord } from '@/types/session';
import type { RuntimeSkill } from '@/types/skill-state';
import type { Student } from '@/types/student';

const NOW = new Date('2026-08-28T20:00:00.000Z');
const MINUTES = 60_000;

function open(subject: string): TutorSessionRecord {
  return {
    id: `session-${subject}`,
    studentId: 'student-1',
    subject,
    grade: '4',
    band: 'middle',
    startedAt: new Date(NOW.getTime() - 40 * MINUTES),
    endedAt: null,
    endReason: null,
    plan: { skillCode: 'add-within-100' },
    summary: null,
  };
}

function harness(
  existing: TutorSessionRecord | null,
  lastActivityAt: Date,
  skills: { due: RuntimeSkill[]; practice: RuntimeSkill | null } = {
    due: [skill()],
    practice: null,
  },
) {
  const fresh = { ...open('math'), id: 'session-fresh', startedAt: NOW };
  const sessions = {
    create: vi.fn(() => Promise.resolve(fresh)),
    findOpen: vi.fn(() => Promise.resolve(existing)),
    end: vi.fn(() => Promise.resolve(existing)),
  };
  const start = vi.fn(() => Promise.resolve([]));
  const findPractice = vi.fn(() => Promise.resolve(skills.practice));
  const service = createSessionService({
    students: { requireById: () => Promise.resolve(student()) },
    sessions,
    skills: {
      findDue: () => Promise.resolve(skills.due),
      findPractice,
    },
    arrivals: {
      findById: () => Promise.resolve(null),
      setAccepted: () => Promise.resolve(true),
    },
    clock: fixedClock(NOW),
    ids: { next: () => 'event-1' },
    resume: (session) => Promise.resolve({ session, moves: [], lastAppliedSeq: 3, lastActivityAt }),
    start,
  });
  return { service, sessions, start, fresh, findPractice };
}

function student(): Student {
  return {
    id: 'student-1',
    parentId: 'parent-1',
    displayName: 'Sam',
    grade: '4',
    band: 'middle',
    settings: { shareFirstName: true, pronunciation: null, avatar: 'fox' },
    createdAt: NOW,
  };
}

function skill(): RuntimeSkill {
  return {
    code: 'add-within-100',
    subject: 'arithmetic',
    strand: 'addition',
    name: 'Add within 100',
    band: 'middle',
    prerequisites: [],
  };
}

const pick = {
  studentId: 'student-1',
  subject: 'math',
  grade: '4' as const,
  fromRecommendation: false,
};

describe('picking a class with a session still open', () => {
  it('resumes the lesson the child is still in', async () => {
    const { service, sessions, start } = harness(
      open('math'),
      new Date(NOW.getTime() - 2 * MINUTES),
    );

    await expect(service.createOrResume(pick)).resolves.toMatchObject({
      session: { id: 'session-math' },
      resumed: true,
    });
    expect(sessions.end).not.toHaveBeenCalled();
    expect(start).not.toHaveBeenCalled();
  });

  it('ends a session for a different class and starts the one they picked', async () => {
    const { service, sessions, fresh } = harness(
      open('reading'),
      new Date(NOW.getTime() - 2 * MINUTES),
    );

    await expect(service.createOrResume(pick)).resolves.toMatchObject({
      session: { id: fresh.id },
      resumed: false,
    });
    expect(sessions.end).toHaveBeenCalledExactlyOnceWith('session-reading', 'break', NOW);
  });

  it('ends a session nobody has touched for half an hour, even for the same class', async () => {
    const { service, sessions, fresh } = harness(
      open('math'),
      new Date(NOW.getTime() - 31 * MINUTES),
    );

    await expect(service.createOrResume(pick)).resolves.toMatchObject({
      session: { id: fresh.id },
      resumed: false,
    });
    expect(sessions.end).toHaveBeenCalledExactlyOnceWith('session-math', 'break', NOW);
  });
});

describe('picking a class with nothing due in it', () => {
  it('practises the skill that comes up next instead of refusing the class', async () => {
    const { service, sessions } = harness(null, NOW, {
      due: [],
      practice: { ...skill(), code: 'WR.PARAGRAPH', subject: 'writing' },
    });

    await expect(service.createOrResume({ ...pick, subject: 'writing' })).resolves.toMatchObject({
      resumed: false,
    });
    expect(sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({ plan: { skillCode: 'WR.PARAGRAPH', checkIn: null } }),
    );
  });

  it('asks the inventory by its own subject name: "math" is "arithmetic" there', async () => {
    const { service, findPractice } = harness(null, NOW, { due: [], practice: skill() });

    await service.createOrResume(pick);

    expect(findPractice).toHaveBeenCalledExactlyOnceWith('student-1', 'arithmetic', 'middle');
  });

  it('still refuses a class the inventory has no skill for at all', async () => {
    const { service } = harness(null, NOW, { due: [], practice: null });

    await expect(service.createOrResume({ ...pick, subject: 'science' })).rejects.toThrow(
      'subject is not available',
    );
  });
});
