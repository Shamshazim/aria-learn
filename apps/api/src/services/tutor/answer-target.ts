import { tutorMoveSchema, type TutorMove } from '@aria/shared';

import type { Logger } from '@/lib/logger';
import type { SessionEventRepository } from '@/repositories/session-event.repository';
import type { SessionEventRecord } from '@/types/session';

/**
 * Which question an `ANSWER` is for, when the client and the API disagree.
 *
 * Clients race the API. A hint re-asks the same item under a new move id; a silence timer
 * fires after the child has started tapping; a tablet resumes with a question it saw last
 * week. Rejecting every one of those with a 400 meant a child who answered correctly saw
 * nothing happen, and then heard "still with me?" — the silence ladder counting an answer
 * that was refused as a silence (P2H-01 sibling of `stale-silence.ts`).
 *
 * So an answer to an earlier asking of the *same item* is graded against the current one,
 * and an answer to anything else is met with the current moves again, so the client can catch
 * up, rather than an error it had no way to show.
 */
export type AskMove = Extract<TutorMove, { kind: 'ASK' }>;
export type AskRecord = SessionEventRecord & Readonly<{ ask: AskMove }>;

export type AnswerTarget =
  | Readonly<{ kind: 'current' | 'reasked'; ask: AskRecord }>
  | Readonly<{ kind: 'stale'; latest: AskRecord | null }>;

export function askRecords(records: readonly SessionEventRecord[]): readonly AskRecord[] {
  return records.flatMap((record) => {
    if (record.actor !== 'aria') return [];
    const parsed = tutorMoveSchema.safeParse(record.payload);
    return parsed.success && parsed.data.kind === 'ASK' ? [{ ...record, ask: parsed.data }] : [];
  });
}

export function latestAskRecord(records: readonly SessionEventRecord[]): AskRecord | null {
  return askRecords(records).at(-1) ?? null;
}

export function resolveAnswerTarget(
  records: readonly SessionEventRecord[],
  respondsTo: string,
): AnswerTarget {
  const asks = askRecords(records);
  const latest = asks.at(-1);
  if (latest === undefined) return { kind: 'stale', latest: null };
  if (latest.ask.id === respondsTo) return { kind: 'current', ask: latest };
  const target = asks.find((record) => record.ask.id === respondsTo);
  if (target !== undefined && target.ask.itemId === latest.ask.itemId) {
    return { kind: 'reasked', ask: latest };
  }
  return { kind: 'stale', latest };
}

/**
 * The evidence for a question, across every asking of it.
 *
 * A re-asked item is committed with the hint turn's evidence, so its answer key lives on the
 * first asking. Later askings override earlier ones where they say anything at all.
 */
export function questionEvidence(
  records: readonly SessionEventRecord[],
  ask: AskRecord,
): Readonly<Record<string, unknown>> {
  return askRecords(records)
    .filter((record) => record.ask.itemId === ask.ask.itemId && record.seq <= ask.seq)
    .reduce<Record<string, unknown>>((merged, record) => ({ ...merged, ...record.evidence }), {});
}

/** Aria's moves from the current question onward: what the client should be showing. */
export function movesSince(
  records: readonly SessionEventRecord[],
  ask: AskRecord,
): readonly TutorMove[] {
  return records
    .filter((record) => record.actor === 'aria' && record.seq >= ask.seq)
    .flatMap((record) => {
      const parsed = tutorMoveSchema.safeParse(record.payload);
      return parsed.success ? [parsed.data] : [];
    });
}

export type AnswerResync = (
  input: Readonly<{ sessionId: string; respondsTo: string }>,
) => Promise<readonly TutorMove[] | null>;

/** `null` when the answer can be graded; otherwise the moves the client has fallen behind. */
export function createAnswerResync(
  events: Pick<SessionEventRepository, 'list'>,
  logger: Pick<Logger, 'info'>,
): AnswerResync {
  return async ({ sessionId, respondsTo }) => {
    const records = await events.list(sessionId);
    const target = resolveAnswerTarget(records, respondsTo);
    if (target.kind !== 'stale' || target.latest === null) return null;
    logger.info(
      { event: 'stale_answer', sessionId, respondsTo, currentMoveId: target.latest.ask.id },
      'Re-sent the current question for an answer to one Aria had already moved past',
    );
    return movesSince(records, target.latest);
  };
}
