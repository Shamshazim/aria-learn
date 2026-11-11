import {
  PROTOCOL_VERSION,
  bandForGrade,
  sessionIdSchema,
  type Band,
  type Grade,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';
import { buildSessionPlan, dueSkills, type SkillGraph } from '@aria/tutor';

import { ForbiddenError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { ArrivalEventRepository } from '@/repositories/arrival-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import { progressMap } from '@/services/scheduler/scheduler-state';
import { planFields } from '@/services/scheduler/session-plan';
import type { ResumedSession } from '@/services/session/resume.service';
import type { TutorSessionRecord } from '@/types/session';

export type SessionStart = Readonly<{
  session: TutorSessionRecord;
  moves: readonly TutorMove[];
  resumed: boolean;
}>;

export type SessionService = Readonly<{
  createOrResume(
    input: Readonly<{
      studentId: string;
      subject: string;
      grade: Grade;
      fromRecommendation: boolean;
      arrivalId?: string;
      checkIn?: string;
    }>,
  ): Promise<SessionStart>;
  current(studentId: string): Promise<ResumedSession | null>;
}>;

export function createSessionService(deps: {
  students: Pick<StudentRepository, 'requireById'>;
  sessions: Pick<SessionRepository, 'create' | 'findOpen' | 'end'>;
  skills: Pick<SkillStateRepository, 'listForStudent' | 'findPractice'>;
  /** P3-04: the prerequisite graph the session plan is built over. */
  graph: SkillGraph;
  arrivals: Pick<ArrivalEventRepository, 'findById' | 'setAccepted'>;
  clock: Clock;
  ids: IdGenerator;
  resume(session: TutorSessionRecord): Promise<ResumedSession>;
  start(session: TutorSessionRecord, event: TutorInputEvent): Promise<readonly TutorMove[]>;
  /**
   * Development only: the requested grade is used instead of the child's, so a developer
   * can open any grade's class from the picker's dropdown. Off, the request's grade is
   * ignored and the child's own grade decides, as it always did.
   */
  allowGradeOverride?: boolean;
}): SessionService {
  return {
    createOrResume: (
      input: Readonly<{
        studentId: string;
        subject: string;
        grade: Grade;
        fromRecommendation: boolean;
        arrivalId?: string;
        checkIn?: string;
      }>,
    ) => createOrResume(deps, input),
    current: async (studentId: string) => {
      const session = await deps.sessions.findOpen(studentId);
      return session === null ? null : deps.resume(session);
    },
  };
}

async function createOrResume(
  deps: Parameters<typeof createSessionService>[0],
  input: Readonly<{
    studentId: string;
    subject: string;
    grade: Grade;
    fromRecommendation: boolean;
    arrivalId?: string;
    checkIn?: string;
  }>,
): Promise<SessionStart> {
  const open = await deps.sessions.findOpen(input.studentId);
  if (open !== null) {
    const resumed = await deps.resume(open);
    if (isResumable(open, resumed.lastActivityAt, input.subject, deps.clock.now())) {
      return { session: open, moves: resumed.moves, resumed: true };
    }
    await deps.sessions.end(open.id, 'break', deps.clock.now());
  }
  const student = learnerFor(deps, await deps.students.requireById(input.studentId), input.grade);
  const recommendationAccepted = await recommendationAcceptance(deps, input);
  const planned = await planSession(deps, input.studentId, input.subject, student);
  if (planned === null) throw new ValidationError('subject is not available for this grade band');
  const session = await createSessionOrResumeWinner(deps, {
    studentId: input.studentId,
    subject: input.subject,
    grade: student.grade,
    band: student.band,
    plan: { ...planned, checkIn: input.checkIn ?? null },
  });
  if ('moves' in session) return session;
  const event = {
    id: deps.ids.next(),
    at: deps.clock.now().toISOString(),
    protocolVersion: PROTOCOL_VERSION,
    sessionId: sessionIdSchema.parse(session.id),
    kind: 'SUBJECT_CHOSEN',
    subjectId: input.subject,
    grade: student.grade,
    fromRecommendation: recommendationAccepted,
  } satisfies TutorInputEvent;
  try {
    const moves = await deps.start(session, event);
    if (input.arrivalId !== undefined) {
      await deps.arrivals.setAccepted(input.arrivalId, input.studentId, recommendationAccepted);
    }
    return { session, moves, resumed: false };
  } catch (error) {
    await deps.sessions.end(session.id, 'break', deps.clock.now());
    throw error;
  }
}

/** The grade and band the session is taught at: the child's, unless a developer overrode it. */
function learnerFor(
  deps: Pick<Parameters<typeof createSessionService>[0], 'allowGradeOverride'>,
  student: Readonly<{ band: Band; grade: Grade }>,
  requested: Grade,
): Readonly<{ band: Band; grade: Grade }> {
  if (deps.allowGradeOverride !== true || requested === student.grade) return student;
  return { grade: requested, band: bandForGrade(requested) };
}

/**
 * What this class works on (P3-04): the scheduler's plan over what is due in the subject —
 * a warm-up, the due skills in rank order, and for the early band something out loud to
 * finish — starting on its first step. When nothing in the subject is due or open, the class's
 * next topic in teaching order: a class with nothing due is still a class, and the child is
 * never told the subject does not exist today.
 *
 * Built once, here. A resumed session keeps the plan it was created with.
 */
async function planSession(
  deps: Parameters<typeof createSessionService>[0],
  studentId: string,
  subject: string,
  student: Readonly<{ band: Band; grade: Grade }>,
): Promise<Readonly<Record<string, unknown>> | null> {
  const progress = progressMap(await deps.skills.listForStudent(studentId));
  const due = dueSkills({
    graph: deps.graph,
    progress,
    now: deps.clock.now(),
    // P6-04 supplies a parent's goals; until then there are none to rank first.
    goals: [],
    scope: { subject: authoredSubject(subject), band: student.band, grade: student.grade },
  });
  const plan = buildSessionPlan({ band: student.band, due, graph: deps.graph, progress });
  const first = plan.steps[0];
  if (first !== undefined) return { skillCode: first.skillCode, ...planFields(plan) };
  const practice = await deps.skills.findPractice(studentId, authoredSubject(subject), {
    band: student.band,
    grade: student.grade,
  });
  return practice === null ? null : { skillCode: practice.code };
}

async function createSessionOrResumeWinner(
  deps: Parameters<typeof createSessionService>[0],
  input: Parameters<SessionRepository['create']>[0],
): Promise<TutorSessionRecord | SessionStart> {
  try {
    return await deps.sessions.create(input);
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;
    const winner = await deps.sessions.findOpen(input.studentId);
    if (winner === null) throw error;
    const resumed = await deps.resume(winner);
    return { session: winner, moves: resumed.moves, resumed: true };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505';
}

async function recommendationAcceptance(
  deps: Parameters<typeof createSessionService>[0],
  input: Parameters<SessionService['createOrResume']>[0],
): Promise<boolean> {
  if (input.arrivalId === undefined) return false;
  const arrival = await deps.arrivals.findById(input.arrivalId, input.studentId);
  if (arrival === null) throw new ForbiddenError('arrival does not belong to student');
  const recommended = arrival.recommendation?.subjectId;
  return typeof recommended === 'string' && recommended === input.subject;
}

/**
 * A lesson the child is still in comes back; a leftover does not.
 *
 * Picking a different class is a decision, not a reconnect, and a question from this morning
 * is not the one they came back for. Either way the old session ends as a break and a fresh
 * one starts — which is also what stops an answer landing on a question the tablet no longer
 * shows. Half an hour is the idle window P2H-12 already ends sessions at.
 */
const RESUME_WINDOW_MS = 30 * 60_000;

function isResumable(
  open: TutorSessionRecord,
  lastActivityAt: Date,
  subject: string,
  now: Date,
): boolean {
  return open.subject === subject && now.getTime() - lastActivityAt.getTime() < RESUME_WINDOW_MS;
}

/** The picker says "math"; the inventory says "arithmetic". */
function authoredSubject(requested: string): string {
  return requested === 'math' ? 'arithmetic' : requested;
}
