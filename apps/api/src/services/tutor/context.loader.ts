import type { TutorInputEvent } from '@aria/shared';
import {
  stepBack,
  switchStrand,
  type LoadedTurnContext,
  type MisconceptionHistory,
  type SkillGraph,
} from '@aria/tutor';

import type { LessonNote } from '@/curriculum';
import { NotFoundError, ValidationError } from '@/errors';
import type { Clock } from '@/lib/clock';
import type { RawDialogueTurn } from '@/privacy';
import { arithmeticProblemSchema } from '@/quality/arithmetic';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import type { MemoryRetrieval } from '@/services/memory/retrieve.service';
import { progressMap } from '@/services/scheduler/scheduler-state';
import { nextPlannedSkill, readPlanSteps } from '@/services/scheduler/session-plan';
import {
  isCheckInReply,
  latestAskRecord,
  questionEvidence,
  resolveAnswerTarget,
  type AskRecord,
} from '@/services/tutor/answer-target';
import { dialogueWindow } from '@/services/tutor/dialogue-window';
import { engagementContext } from '@/services/tutor/engagement-context';
import {
  consecutiveSilences,
  consecutiveStuck,
  consecutiveWrong,
  correctStreak,
  latestEvidenceString,
  previousMisconception,
  recentEvidenceStrings,
  wrongOnSkill,
} from '@/services/tutor/session-counters';

export type TutorContextLoader = Readonly<{
  load(event: TutorInputEvent): Promise<LoadedTurnContext<ApiModelContext>>;
}>;

export function createTutorContextLoader(deps: {
  sessions: SessionRepository;
  events: SessionEventRepository;
  skills: SkillStateRepository;
  students: StudentRepository;
  /** P3-04: the prerequisite graph the step back and the change of strand are read from. */
  graph: SkillGraph;
  clock: Clock;
  misconceptionIds(skillCode: string): readonly string[];
  /** P2H-10: the teaching note for a skill, or nothing where the skill has no note. */
  lesson(skillCode: string): LessonNote | null;
  /** The topic after this one in teaching order, so a finished topic has somewhere to go. */
  nextTopic(skillCode: string): string | null;
  retrieve(
    input: Readonly<{
      sessionId: string;
      studentId: string;
      band: string;
      skillCode: string | null;
      identifiers: Readonly<{ fullName?: string }>;
      recentEvidence?: readonly string[];
      recentDialogue?: readonly RawDialogueTurn[];
      shareFirstName?: boolean;
    }>,
  ): Promise<MemoryRetrieval>;
}): TutorContextLoader {
  return { load: (event: TutorInputEvent) => load(deps, event) };
}

async function load(
  deps: Parameters<typeof createTutorContextLoader>[0],
  event: TutorInputEvent,
): Promise<LoadedTurnContext<ApiModelContext>> {
  if (event.sessionId === undefined) throw new NotFoundError('turn needs a session id');
  const session = await deps.sessions.findById(event.sessionId);
  if (session?.endedAt !== null) throw new NotFoundError('open session not found');
  const [records, student] = await Promise.all([
    deps.events.list(session.id),
    deps.students.requireById(session.studentId),
  ]);
  const ask = answerAsk(records, event);
  const askEvidence = ask === null ? {} : questionEvidence(records, ask);
  const skillCode = stringPlanValue(session.plan, 'skillCode');
  const [skillContext, memory] = await Promise.all([
    loadSkillContext(deps, session.studentId, skillCode, session.plan),
    deps.retrieve({
      sessionId: session.id,
      studentId: session.studentId,
      band: session.band,
      skillCode,
      identifiers: { fullName: student.displayName },
      recentDialogue: dialogueWindow(records, session.band),
      // P2H-12: the parent's answer, not ours.
      shareFirstName: student.settings.shareFirstName,
      ...checkInEvidence(session.plan),
    }),
  ]);
  return {
    session: {
      ...sessionContext(session, records, skillCode, skillContext),
      engagement: engagementContext(records, event, session.band),
    },
    modelContext: modelContext(deps, { records, memory, ask, askEvidence, skillCode }),
    recentKinds: records.map((record) => record.kind),
  };
}

type SessionRecord = NonNullable<Awaited<ReturnType<SessionRepository['findById']>>>;
type Records = Awaited<ReturnType<SessionEventRepository['list']>>;

function sessionContext(
  session: SessionRecord,
  records: Records,
  skillCode: string | null,
  skillContext: Awaited<ReturnType<typeof loadSkillContext>>,
): LoadedTurnContext<ApiModelContext>['session'] {
  return {
    id: session.id,
    studentId: session.studentId,
    subject: session.subject,
    grade: session.grade,
    band: session.band,
    skillCode,
    startedAt: session.startedAt,
    attempts: Math.min(10, consecutiveWrong(records)),
    consecutiveWrong: consecutiveWrong(records),
    consecutiveSilences: consecutiveSilences(records),
    consecutiveStuck: consecutiveStuck(records),
    correctStreak: correctStreak(records),
    repeatedMisconception:
      latestEvidenceString(records, 'misconception') ?? skillContext.repeatedMisconception,
    lastApproach: latestEvidenceString(records, 'approach'),
    unmetPrerequisite: skillContext.stepBack,
    nextTopic: skillContext.nextTopic,
    wrongOnSkill: wrongOnSkill(records, skillCode),
    previousMisconception: previousMisconception(records),
    misconceptionHistory: skillContext.misconceptionHistory,
    alternateStrandSkill: skillContext.alternateStrand,
  };
}

function modelContext(
  deps: Parameters<typeof createTutorContextLoader>[0],
  {
    records,
    memory,
    ask,
    askEvidence,
    skillCode,
  }: Readonly<{
    records: Records;
    memory: MemoryRetrieval;
    ask: AskRecord | null;
    askEvidence: Readonly<Record<string, unknown>>;
    skillCode: string | null;
  }>,
): ApiModelContext {
  return {
    scrubbed: memory.context,
    answerKey: evidenceString(askEvidence, 'answerKey'),
    latestQuestion: ask?.text ?? null,
    estimatedTokens: memory.estimatedTokens,
    retrievedFactIds: memory.factIds,
    recentContentItemIds: recentEvidenceStrings(records, 'contentItemId', 5),
    recentIntents: [...recentEvidenceStrings(records, 'intent', 3)].reverse(),
    arithmeticProblem: askArithmeticProblem(askEvidence),
    lesson: skillCode === null ? null : deps.lesson(skillCode),
    completionOnly: evidenceBoolean(askEvidence, 'completionOnly') ?? false,
    latestAsk: ask?.ask ?? null,
  };
}

/**
 * What the policy needs to know about the skill (P3-04): the weakest step underneath it, a
 * skill in another strand for when nothing underneath is weak, what the record says about its
 * misconceptions, and where the plan goes next.
 */
async function loadSkillContext(
  deps: Parameters<typeof createTutorContextLoader>[0],
  studentId: string,
  skillCode: string | null,
  plan: Readonly<Record<string, unknown>>,
) {
  if (skillCode === null) {
    return {
      stepBack: null,
      alternateStrand: null,
      repeatedMisconception: null,
      misconceptionHistory: {},
      nextTopic: null,
    } as const;
  }
  const [states, misconceptions] = await Promise.all([
    deps.skills.listForStudent(studentId),
    misconceptionHistory(deps, studentId, skillCode),
  ]);
  const progress = progressMap(states);
  return {
    stepBack: stepBack(skillCode, progress, deps.graph),
    alternateStrand: switchStrand(skillCode, progress, deps.graph, deps.clock.now()),
    repeatedMisconception:
      Object.entries(misconceptions).find(([, history]) => !history.cleared)?.[0] ?? null,
    misconceptionHistory: misconceptions,
    nextTopic: nextPlannedSkill(readPlanSteps(plan), skillCode) ?? deps.nextTopic(skillCode),
  };
}

/** Every misconception on the skill this child has been seen with, by authored id. */
async function misconceptionHistory(
  deps: Parameters<typeof createTutorContextLoader>[0],
  studentId: string,
  skillCode: string,
): Promise<Readonly<Record<string, MisconceptionHistory>>> {
  const ids = deps.misconceptionIds(skillCode);
  const states = await Promise.all(
    ids.map((id) => deps.skills.findMisconceptionState(studentId, id)),
  );
  return Object.fromEntries(
    states.flatMap((state) =>
      state === null || state.seenCount === 0
        ? []
        : [[state.misconceptionId, { seenCount: state.seenCount, cleared: state.cleared }]],
    ),
  );
}

function checkInEvidence(
  plan: Readonly<Record<string, unknown>>,
): Readonly<{ recentEvidence?: readonly string[] }> {
  const checkIn = stringPlanValue(plan, 'checkIn');
  return checkIn === null ? {} : { recentEvidence: [`Check-in: ${checkIn}`] };
}

function evidenceBoolean(evidence: Readonly<Record<string, unknown>>, key: string): boolean | null {
  const value = evidence[key];
  return typeof value === 'boolean' ? value : null;
}

function askArithmeticProblem(
  evidence: Readonly<Record<string, unknown>>,
): ApiModelContext['arithmeticProblem'] {
  const parsed = arithmeticProblemSchema.safeParse(evidence.arithmeticProblem);
  return parsed.success ? parsed.data : null;
}

function evidenceString(evidence: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = evidence[key];
  return typeof value === 'string' ? value : null;
}

/**
 * The question this event is about. An answer to an earlier asking of the same item is graded
 * against the current asking; anything staler was already met with a re-sync before the
 * context was loaded (`answer-target.ts`), so reaching here with one is a programming error.
 */
function answerAsk(
  records: Awaited<ReturnType<SessionEventRepository['list']>>,
  event: TutorInputEvent,
): AskRecord | null {
  if (event.kind !== 'ANSWER') return latestAskRecord(records);
  if (isCheckInReply(records, event.respondsTo)) return latestAskRecord(records);
  const target = resolveAnswerTarget(records, event.respondsTo);
  if (target.kind === 'stale') {
    throw new ValidationError('answer does not target the active question');
  }
  return target.ask;
}

function stringPlanValue(plan: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = plan[key];
  return typeof value === 'string' ? value : null;
}
