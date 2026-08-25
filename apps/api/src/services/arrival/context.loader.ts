import type { Clock } from '@/lib/clock';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { LearnerFact } from '@/types/memory';
import type { SessionEventRecord, TutorSessionRecord } from '@/types/session';
import type { RuntimeSkill } from '@/types/skill-state';
import type { Student } from '@/types/student';

export type ArrivalContext = Readonly<{
  student: Student;
  lastSession: TutorSessionRecord | null;
  evidence: SessionEventRecord | null;
  dueSkills: readonly RuntimeSkill[];
  facts: readonly LearnerFact[];
  now: Date;
}>;

export type ArrivalContextLoader = Readonly<{
  load(studentId: string): Promise<ArrivalContext>;
}>;

export function createArrivalContextLoader(deps: {
  students: StudentRepository;
  sessions: SessionRepository;
  events: SessionEventRepository;
  skills: SkillStateRepository;
  memory: LearnerMemoryRepository;
  clock: Clock;
}): ArrivalContextLoader {
  return {
    load: async (studentId: string) => {
      const [student, lastSession, evidence, dueSkills, facts] = await Promise.all([
        deps.students.requireById(studentId),
        deps.sessions.findLatestEnded(studentId),
        deps.events.findLatestEvidence(studentId),
        deps.skills.findDue(studentId, deps.clock.now()),
        deps.memory.listCurrent(studentId, deps.clock.now()),
      ]);
      return { student, lastSession, evidence, dueSkills, facts, now: deps.clock.now() };
    },
  };
}
