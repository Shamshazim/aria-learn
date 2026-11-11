import {
  ENGAGEMENT_STATES,
  tutorInputEventSchema,
  tutorMoveSchema,
  type Band,
  type EngagementStateKind,
  type TutorInputEvent,
  type TutorMove,
} from '@aria/shared';
import {
  ENGAGEMENT_THRESHOLDS,
  eventSignals,
  gradedSignals,
  statementSignal,
  type EngagementContext,
  type EngagementHistory,
  type EngagementSignal,
  type OpenCheckIn,
} from '@aria/tutor';

import { askRecords, questionEvidence } from '@/services/tutor/answer-target';
import type { SessionEventRecord } from '@/types/session';

type Records = readonly SessionEventRecord[];

/** The `session_event.kind` an engagement inference is logged under (P3-05). */
export const ENGAGEMENT_EVENT_KIND = 'ENGAGEMENT';

const ADAPTED = new Set(['shorten', 'switch_modality', 'change_subject', 'offer_break']);

/**
 * The session's engagement evidence, read back from its log (P3-05).
 *
 * Nothing about engagement is stored anywhere else: a state lives only as long as the session
 * log says it does, and the log is where false inferences are counted later.
 */
export function engagementContext(
  records: Records,
  event: TutorInputEvent,
  band: Band,
): EngagementContext {
  return {
    signals: pastSignals(records, band),
    history: history(records),
    previous: previous(records),
    openCheckIn: openCheckIn(records),
    current: answerSetting(records, event),
  };
}

function pastSignals(records: Records, band: Band): readonly EngagementSignal[] {
  const signals: EngagementSignal[] = [];
  let wrongRun = 0;
  let silenceRun = 0;
  for (const [index, record] of records.entries()) {
    if (record.actor === 'system') {
      if (typeof record.evidence.engagementDenied === 'string') {
        signals.push({ name: 'said_fine', at: record.at });
      }
      continue;
    }
    if (record.actor !== 'child') continue;
    silenceRun = record.kind === 'SILENCE' ? silenceRun + 1 : 0;
    if (silenceRun >= ENGAGEMENT_THRESHOLDS[band].silenceRun) {
      signals.push({ name: 'silence', at: record.at });
    }
    signals.push(...childSignals(records.slice(0, index), record, { band, wrongRun }));
    if (record.correct !== null) wrongRun = record.correct ? 0 : wrongRun + 1;
  }
  return signals;
}

/** What one thing the child did says: a stop, a statement, its pace, its grade. */
function childSignals(
  before: Records,
  record: SessionEventRecord,
  run: Readonly<{ band: Band; wrongRun: number }>,
): readonly EngagementSignal[] {
  const signals: EngagementSignal[] = [];
  if (record.evidence.intent === 'STOP_REQUEST')
    signals.push({ name: 'stop_request', at: record.at });
  const statement = record.text === null ? null : statementSignal(record.text, record.at);
  if (statement !== null) signals.push(statement);
  const passive = recordedEvent(record);
  const own =
    passive === null
      ? []
      : eventSignals(passive, { band: run.band, ...answerSetting(before, passive) });
  signals.push(...own);
  if (record.correct !== null) {
    const slow = own.some((signal) => signal.name === 'latency_slow');
    signals.push(
      ...gradedSignals(
        { correct: record.correct },
        { band: run.band, wrongBefore: run.wrongRun, slow, at: record.at },
      ),
    );
  }
  return signals;
}

/** What this session has done about each state, from its `ENGAGEMENT` rows. */
function history(records: Records): EngagementHistory {
  const checkedIn: EngagementStateKind[] = [];
  const adapted: EngagementStateKind[] = [];
  const escalated: EngagementStateKind[] = [];
  const denied: EngagementStateKind[] = [];
  for (const record of engagementRows(records)) {
    const state = stateOf(record.evidence.engagementState);
    const decision = record.evidence.engagementDecision;
    const deniedState = stateOf(record.evidence.engagementDenied);
    if (deniedState !== null) denied.push(deniedState);
    if (state === null) continue;
    if (decision === 'check_in') checkedIn.push(state);
    if (record.evidence.engagementEscalated === true) escalated.push(state);
    else if (typeof decision === 'string' && ADAPTED.has(decision)) adapted.push(state);
  }
  return { checkedIn, adapted, escalated, denied };
}

function previous(records: Records): EngagementContext['previous'] {
  const last = engagementRows(records).at(-1);
  const kind = stateOf(last?.evidence.engagementState);
  const confidence = last?.evidence.engagementConfidence;
  return kind === null || typeof confidence !== 'number' ? null : { kind, confidence };
}

/** The last thing Aria did was ask how the child is, and they have not answered yet. */
function openCheckIn(records: Records): OpenCheckIn | null {
  for (const record of [...records].reverse()) {
    if (record.actor === 'child' && (record.kind === 'ANSWER' || record.kind === 'SPEECH_FINAL')) {
      return null;
    }
    if (record.actor !== 'aria') continue;
    const state = stateOf(record.evidence.engagementCheckIn);
    const move = recordedMove(record);
    if (state === null || state === 'ready' || move?.kind !== 'CHECK_IN') return null;
    return { state, moveId: move.id };
  }
  return null;
}

/**
 * What the question an event answers expected, so its passive signals mean something. The
 * answer key is read across every asking of the item — a re-asked item keeps its key on the
 * first asking — so a re-ask is never mistaken for an open question.
 */
function answerSetting(
  records: Records,
  event: TutorInputEvent,
): Readonly<{ expects: string | null; openQuestion: boolean }> {
  const respondsTo = event.kind === 'ANSWER' ? event.respondsTo : null;
  const asks = askRecords(records);
  const answered =
    respondsTo === null ? asks.at(-1) : asks.find((record) => record.ask.id === respondsTo);
  if (answered === undefined) return { expects: null, openQuestion: false };
  const key = questionEvidence(records, answered).answerKey;
  return { expects: answered.ask.expects, openQuestion: typeof key !== 'string' || key === '' };
}

function engagementRows(records: Records): Records {
  return records.filter(
    (record) => record.actor === 'system' && record.kind === ENGAGEMENT_EVENT_KIND,
  );
}

function recordedMove(record: SessionEventRecord): TutorMove | null {
  if (record.actor !== 'aria') return null;
  const parsed = tutorMoveSchema.safeParse(record.payload);
  return parsed.success ? parsed.data : null;
}

function recordedEvent(record: SessionEventRecord): TutorInputEvent | null {
  const parsed = tutorInputEventSchema.safeParse(record.payload);
  return parsed.success ? parsed.data : null;
}

function stateOf(value: unknown): EngagementStateKind | null {
  return ENGAGEMENT_STATES.find((state) => state === value) ?? null;
}
