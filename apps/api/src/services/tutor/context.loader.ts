import { tutorMoveSchema, type TutorInputEvent } from '@aria/shared';
import type { LoadedTurnContext } from '@aria/tutor';

import { NotFoundError, ValidationError } from '@/errors';
import type { RawDialogueTurn } from '@/privacy';
import { arithmeticProblemSchema } from '@/quality/arithmetic';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionRepository } from '@/repositories/session.repository';
import type { SkillStateRepository } from '@/repositories/skill-state.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { ApiModelContext } from '@/services/content/turn-content.service';
import type { MemoryRetrieval } from '@/services/memory/retrieve.service';

export type TutorContextLoader = Readonly<{
  load(event: TutorInputEvent): Promise<LoadedTurnContext<ApiModelContext>>;
}>;

export function createTutorContextLoader(deps: {
  sessions: SessionRepository;
  events: SessionEventRepository;
  skills: SkillStateRepository;
  students: StudentRepository;
  misconceptionIds(skillCode: string): readonly string[];
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
  const skillCode = stringPlanValue(session.plan, 'skillCode');
  const [skillContext, memory] = await Promise.all([
    loadSkillContext(deps, session.studentId, skillCode),
    deps.retrieve({
      sessionId: session.id,
      studentId: session.studentId,
      band: session.band,
      skillCode,
      identifiers: { fullName: student.displayName },
      recentDialogue: dialogueWindow(records, session.band),
      shareFirstName: true,
      ...checkInEvidence(session.plan),
    }),
  ]);
  return {
    session: {
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
      repeatedMisconception:
        latestEvidenceString(records, 'misconception') ?? skillContext.repeatedMisconception,
      lastApproach: latestEvidenceString(records, 'approach'),
      unmetPrerequisite: skillContext.unmet[0]?.code ?? null,
    },
    modelContext: {
      scrubbed: memory.context,
      answerKey: askEvidenceString(ask, 'answerKey'),
      latestQuestion: ask?.text ?? null,
      estimatedTokens: memory.estimatedTokens,
      retrievedFactIds: memory.factIds,
      recentContentItemIds: recentEvidenceStrings(records, 'contentItemId', 5),
      arithmeticProblem: askArithmeticProblem(ask),
      completionOnly: askEvidenceBoolean(ask, 'completionOnly') ?? false,
      latestAsk: parsedAskMove(ask),
    },
    recentKinds: records.map((record) => record.kind),
  };
}

async function loadSkillContext(
  deps: Parameters<typeof createTutorContextLoader>[0],
  studentId: string,
  skillCode: string | null,
) {
  if (skillCode === null) return { state: null, unmet: [], repeatedMisconception: null } as const;
  const [state, unmet, repeatedMisconception] = await Promise.all([
    deps.skills.findState(studentId, skillCode),
    deps.skills.findUnmetPrerequisites(studentId, skillCode),
    findKnownMisconception(deps, studentId, skillCode),
  ]);
  return { state, unmet, repeatedMisconception };
}

async function findKnownMisconception(
  deps: Parameters<typeof createTutorContextLoader>[0],
  studentId: string,
  skillCode: string,
): Promise<string | null> {
  const states = await Promise.all(
    deps.misconceptionIds(skillCode).map((id) => deps.skills.findMisconceptionState(studentId, id)),
  );
  return states.find((state) => state !== null && state.seenCount > 0)?.misconceptionId ?? null;
}

function checkInEvidence(
  plan: Readonly<Record<string, unknown>>,
): Readonly<{ recentEvidence?: readonly string[] }> {
  const checkIn = stringPlanValue(plan, 'checkIn');
  return checkIn === null ? {} : { recentEvidence: [`Check-in: ${checkIn}`] };
}

function askEvidenceBoolean(
  record: Awaited<ReturnType<SessionEventRepository['list']>>[number] | undefined,
  key: string,
): boolean | null {
  const value = record?.evidence[key];
  return typeof value === 'boolean' ? value : null;
}

function askArithmeticProblem(
  record: Awaited<ReturnType<SessionEventRepository['list']>>[number] | undefined,
): ApiModelContext['arithmeticProblem'] {
  const parsed = arithmeticProblemSchema.safeParse(record?.evidence.arithmeticProblem);
  return parsed.success ? parsed.data : null;
}

function askEvidenceString(
  record: Awaited<ReturnType<SessionEventRepository['list']>>[number] | undefined,
  key: string,
): string | null {
  const value = record?.evidence[key];
  return typeof value === 'string' ? value : null;
}

function latestAsk(records: Awaited<ReturnType<SessionEventRepository['list']>>) {
  return [...records].reverse().find((record) => record.actor === 'aria' && record.kind === 'ASK');
}

function answerAsk(
  records: Awaited<ReturnType<SessionEventRepository['list']>>,
  event: TutorInputEvent,
) {
  const latest = latestAsk(records);
  if (event.kind !== 'ANSWER') return latest;
  const target = records.find((record) => {
    const parsed = tutorMoveSchema.safeParse(record.payload);
    return parsed.success && parsed.data.kind === 'ASK' && parsed.data.id === event.respondsTo;
  });
  if (target === undefined || parsedAskMove(latest)?.id !== event.respondsTo) {
    throw new ValidationError('answer does not target the active question');
  }
  return target;
}

function parsedAskMove(record: ReturnType<typeof latestAsk>) {
  const parsed = tutorMoveSchema.safeParse(record?.payload);
  return parsed.success && parsed.data.kind === 'ASK' ? parsed.data : null;
}

function recentEvidenceStrings(
  records: Awaited<ReturnType<SessionEventRepository['list']>>,
  key: string,
  limit: number,
): readonly string[] {
  return [...records]
    .reverse()
    .flatMap((record) => {
      const value = record.evidence[key];
      return typeof value === 'string' ? [value] : [];
    })
    .slice(0, limit);
}

function stringPlanValue(plan: Readonly<Record<string, unknown>>, key: string): string | null {
  const value = plan[key];
  return typeof value === 'string' ? value : null;
}

function consecutiveWrong(records: Awaited<ReturnType<SessionEventRepository['list']>>): number {
  let count = 0;
  for (const record of [...records].reverse()) {
    if (record.actor !== 'child' || (record.kind !== 'ANSWER' && record.kind !== 'SPEECH_FINAL'))
      continue;
    if (record.correct === true) break;
    if (record.correct === false) count += 1;
  }
  return count;
}

/** P2H-01: silences since the child last did anything. Backchannels do not reset the count. */
function consecutiveSilences(records: Awaited<ReturnType<SessionEventRepository['list']>>): number {
  let count = 0;
  for (const record of [...records].reverse()) {
    if (record.actor !== 'child') continue;
    if (record.kind === 'SILENCE') count += 1;
    else if (record.kind !== 'BACKCHANNEL' && record.kind !== 'SPEECH_STARTED') break;
  }
  return count;
}

const DIALOGUE_TURNS: Readonly<Record<string, number>> = { early: 6, middle: 10, senior: 14 };

/** P2H-04: the last few spoken turns, oldest first, for the prompt's conversation block. */
function dialogueWindow(
  records: Awaited<ReturnType<SessionEventRepository['list']>>,
  band: string,
): readonly RawDialogueTurn[] {
  return records
    .filter(
      (record): record is typeof record & { text: string } =>
        (record.actor === 'aria' || record.actor === 'child') &&
        typeof record.text === 'string' &&
        record.text.trim() !== '',
    )
    .slice(-(DIALOGUE_TURNS[band] ?? 10))
    .map((record) => ({
      speaker: record.actor === 'aria' ? 'aria' : 'child',
      text: record.text.slice(0, 500),
    }));
}

function latestEvidenceString(
  records: Awaited<ReturnType<SessionEventRepository['list']>>,
  key: string,
): string | null {
  for (const record of [...records].reverse()) {
    const value = record.evidence[key];
    if (typeof value === 'string') return value;
  }
  return null;
}
