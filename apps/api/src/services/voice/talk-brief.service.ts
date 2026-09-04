import type { Band, VoiceBrief } from '@aria/shared';

import type { InventoryService } from '@/curriculum';
import type { Clock } from '@/lib/clock';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { StudentRepository } from '@/repositories/student.repository';
import type { MemoryRetrievalService } from '@/services/memory/retrieve.service';
import { latestAskRecord, questionEvidence, type AskRecord } from '@/services/tutor/answer-target';
import { openTalkSession, type TalkGuardDeps } from '@/services/voice/talk-guard';
import type { TutorSessionRecord } from '@/types/session';

/**
 * What the realtime model teaches from ("Aria talks").
 *
 * Everything in the brief already exists for the text tutor: the skill and its objectives
 * from the catalogue, the teacher's note where there is one, the open question with its key,
 * and the child's memory through the same scrubber every prompt uses. The brief is the same
 * material handed over once, so the model can be Aria for the whole session instead of being
 * told one sentence at a time.
 */
export type TalkBriefDeps = TalkGuardDeps &
  Readonly<{
    events: Pick<SessionEventRepository, 'list'>;
    students: Pick<StudentRepository, 'requireById'>;
    inventory: Pick<InventoryService, 'getSkill' | 'getLesson'>;
    retrieve: MemoryRetrievalService['retrieve'];
    sessionLimitMinutes(band: Band): number;
    clock: Clock;
  }>;

export function createTalkBriefService(
  deps: TalkBriefDeps,
): Readonly<{ brief(sessionId: string, connectionEpoch: number): Promise<VoiceBrief> }> {
  return { brief: (sessionId, connectionEpoch) => brief(deps, sessionId, connectionEpoch) };
}

async function brief(
  deps: TalkBriefDeps,
  sessionId: string,
  connectionEpoch: number,
): Promise<VoiceBrief> {
  const session = await openTalkSession(deps, sessionId, connectionEpoch);
  const [records, student] = await Promise.all([
    deps.events.list(session.id),
    deps.students.requireById(session.studentId),
  ]);
  const skillCode = planSkillCode(session);
  const memory = await deps.retrieve({
    sessionId: session.id,
    studentId: session.studentId,
    band: session.band,
    skillCode,
    identifiers: { fullName: student.displayName },
    shareFirstName: student.settings.shareFirstName,
  });
  const ask = latestAskRecord(records);
  return {
    connectionEpoch,
    student: {
      firstName: memory.context.value.pseudonymousFirstName ?? null,
      grade: session.grade,
      band: session.band,
    },
    subject: session.subject,
    skill: skillBrief(deps, skillCode),
    note: noteBrief(deps, skillCode),
    openQuestion: ask === null ? null : questionBrief(records, ask),
    memory: memoryLines(memory.context.value),
    minutesLeft: minutesLeft(deps, session),
  };
}

function planSkillCode(session: TutorSessionRecord): string | null {
  const value = session.plan.skillCode;
  return typeof value === 'string' && value !== '' ? value : null;
}

function skillBrief(deps: TalkBriefDeps, skillCode: string | null): VoiceBrief['skill'] {
  const skill = skillCode === null ? null : deps.inventory.getSkill(skillCode);
  if (skill === null) return null;
  return {
    code: skill.code,
    name: skill.name,
    unit: skill.unit ?? null,
    lesson: skill.lesson ?? null,
    objectives: [...(skill.objectives ?? [])].slice(0, 16),
  };
}

function noteBrief(deps: TalkBriefDeps, skillCode: string | null): VoiceBrief['note'] {
  const note = skillCode === null ? null : deps.inventory.getLesson(skillCode);
  if (note === null) return null;
  return {
    whatItIs: note.whatItIs,
    oneIdea: note.oneIdea,
    stumbles: [...note.stumbles],
    models: [...note.models],
    workedExample: note.workedExample,
    useLanguage: [...note.useLanguage],
    avoidLanguage: [...note.avoidLanguage],
  };
}

function questionBrief(
  records: Awaited<ReturnType<SessionEventRepository['list']>>,
  ask: AskRecord,
): VoiceBrief['openQuestion'] {
  const evidence = questionEvidence(records, ask);
  const answerKey = evidence.answerKey;
  const options = ask.ask.display.flatMap((item) =>
    item.type === 'choices' ? item.options.map((o) => ({ id: o.id, text: o.label })) : [],
  );
  return {
    id: ask.ask.id,
    prompt: askPrompt(ask),
    answerKey: typeof answerKey === 'string' ? answerKey : null,
    options,
  };
}

function askPrompt(ask: AskRecord): string {
  if (ask.ask.speech !== null) return ask.ask.speech.text;
  return ask.text ?? ask.ask.id;
}

function memoryLines(value: Readonly<{
  learnerMemory?: readonly Readonly<{ category: string; text: string }>[];
  recentEvidence?: readonly string[];
}>): string[] {
  return [
    ...(value.learnerMemory ?? []).map((fact) => fact.text),
    ...(value.recentEvidence ?? []),
  ].slice(0, 24);
}

function minutesLeft(deps: TalkBriefDeps, session: TutorSessionRecord): number {
  const elapsedMs = deps.clock.now().getTime() - session.startedAt.getTime();
  const limit = deps.sessionLimitMinutes(session.band);
  return Math.max(0, Math.round(limit - elapsedMs / 60_000));
}
