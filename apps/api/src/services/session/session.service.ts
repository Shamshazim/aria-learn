import {
  PROTOCOL_VERSION,
  sessionIdSchema,
  type Grade,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';

import { ForbiddenError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { IdGenerator } from '@/lib/ids';
import type { ArrivalEventRepository } from '@/repositories/arrival-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';
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
  students: StudentRepository;
  sessions: SessionRepository;
  skills: SkillStateRepository;
  arrivals: ArrivalEventRepository;
  clock: Clock;
  ids: IdGenerator;
  resume(session: TutorSessionRecord): Promise<ResumedSession>;
  start(session: TutorSessionRecord, event: TutorInputEvent): Promise<readonly TutorMove[]>;
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
    return { session: open, moves: resumed.moves, resumed: true };
  }
  const student = await deps.students.requireById(input.studentId);
  const recommendationAccepted = await recommendationAcceptance(deps, input);
  const due = await deps.skills.findDue(input.studentId, deps.clock.now());
  const skill = due.find(
    (candidate) =>
      candidate.band === student.band && subjectMatches(input.subject, candidate.subject),
  );
  if (skill === undefined)
    throw new ValidationError('subject is not available for this grade band');
  const session = await createSessionOrResumeWinner(deps, {
    studentId: input.studentId,
    subject: input.subject,
    grade: student.grade,
    band: student.band,
    plan: { skillCode: skill.code, checkIn: input.checkIn ?? null },
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

function subjectMatches(requested: string, authored: string): boolean {
  return requested === authored || (requested === 'math' && authored === 'arithmetic');
}
