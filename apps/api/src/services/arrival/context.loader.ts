import { dueSkills, type SchedulerSkill, type SkillGraph } from '@aria/tutor';

import type { Clock } from '@/lib/clock';
import type { LearnerMemoryRepository } from '@/repositories/learner-memory.repository';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import { progressMap } from '@/services/scheduler/scheduler-state';
import type { LearnerFact } from '@/types/memory';
import type { SessionEventRecord, TutorSessionRecord } from '@/types/session';
import type { Student } from '@/types/student';

export type ArrivalContext = Readonly<{
  student: Student;
  lastSession: TutorSessionRecord | null;
  evidence: SessionEventRecord | null;
  /** P3-04: the scheduler's ranking, best first. */
  dueSkills: readonly SchedulerSkill[];
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
  graph: SkillGraph;
  memory: LearnerMemoryRepository;
  clock: Clock;
}): ArrivalContextLoader {
  return {
    load: async (studentId: string) => {
      const [student, lastSession, evidence, states, facts] = await Promise.all([
        deps.students.requireById(studentId),
        deps.sessions.findLatestEnded(studentId),
        deps.events.findLatestEvidence(studentId),
        deps.skills.listForStudent(studentId),
        deps.memory.listCurrent(studentId, deps.clock.now()),
      ]);
      const ranked = dueSkills({
        graph: deps.graph,
        progress: progressMap(states),
        now: deps.clock.now(),
        goals: [],
        scope: { band: student.band, grade: student.grade },
      }).flatMap((due) => {
        const skill = deps.graph.get(due.skillCode);
        return skill === null ? [] : [skill];
      });
      return { student, lastSession, evidence, dueSkills: ranked, facts, now: deps.clock.now() };
    },
  };
}
