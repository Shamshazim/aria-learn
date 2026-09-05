import { askRecords } from '@/services/tutor/answer-target';
import type { SessionEventRecord } from '@/types/session';

/**
 * The counters the teaching policy reads, derived from the session log rather than stored.
 *
 * Deriving them is what makes them honest: a counter written on one code path and forgotten
 * on another is how a child ends up hinted at for the fourth time. Each one here answers a
 * question a human tutor keeps in their head — how many times has this question gone
 * nowhere, how many right in a row, how long since they last said anything.
 */
type Records = readonly SessionEventRecord[];

const UTTERANCE_KINDS: ReadonlySet<string> = new Set(['ANSWER', 'SPEECH_FINAL']);
const STUCK_INTENTS: ReadonlySet<string> = new Set(['CONFUSED', 'SKIP_REQUEST']);

/** Wrong answers since the last right one, across items: the sign that a *skill* is stuck. */
export function consecutiveWrong(records: Records): number {
  let count = 0;
  for (const record of [...records].reverse()) {
    if (!isUtterance(record)) continue;
    if (record.correct === true) break;
    if (record.correct === false) count += 1;
  }
  return count;
}

/**
 * Turns on the current item that went nowhere: a wrong answer, "I don't know", a skip.
 *
 * Counted from the first asking of the item, so a hint's re-ask does not start it over and a
 * reveal's fresh question does — before this the wrong-answer count ran on across items, and
 * the first miss on a new question could be met with the answer.
 */
export function consecutiveStuck(records: Records): number {
  const boundary = currentItemBoundary(records);
  let count = 0;
  for (const record of [...records].reverse()) {
    if (record.seq <= boundary) break;
    if (record.actor !== 'child') continue;
    if (record.correct === true) break;
    if (record.correct === false || isStuckTurn(record)) count += 1;
  }
  return count;
}

/** Right answers in a row on the current skill; a switch of skill starts the count over. */
export function correctStreak(records: Records): number {
  let count = 0;
  for (const record of [...records].reverse()) {
    if (record.actor === 'aria' && record.kind === 'SWITCH') break;
    if (!isUtterance(record)) continue;
    if (record.correct === true) count += 1;
    else if (record.correct === false) break;
  }
  return count;
}

/** P2H-01: silences since the child last did anything. Backchannels do not reset the count. */
export function consecutiveSilences(records: Records): number {
  let count = 0;
  for (const record of [...records].reverse()) {
    if (record.actor !== 'child') continue;
    if (record.kind === 'SILENCE') count += 1;
    else if (record.kind !== 'BACKCHANNEL' && record.kind !== 'SPEECH_STARTED') break;
  }
  return count;
}

export function latestEvidenceString(records: Records, key: string): string | null {
  for (const record of [...records].reverse()) {
    const value = record.evidence[key];
    if (typeof value === 'string') return value;
  }
  return null;
}

/** The last few string values of one evidence key, newest first. */
export function recentEvidenceStrings(
  records: Records,
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

/** The `seq` of the first asking of the item currently on the screen, or 0 with no item. */
function currentItemBoundary(records: Records): number {
  const asks = askRecords(records);
  const latest = asks.at(-1);
  if (latest === undefined) return 0;
  let first = latest;
  for (const ask of [...asks].reverse()) {
    if (ask.ask.itemId !== latest.ask.itemId) break;
    first = ask;
  }
  return first.seq;
}

function isUtterance(record: SessionEventRecord): boolean {
  return record.actor === 'child' && UTTERANCE_KINDS.has(record.kind);
}

function isStuckTurn(record: SessionEventRecord): boolean {
  if (record.kind === 'CONFUSED' || record.kind === 'SKIP') return true;
  const intent = record.evidence.intent;
  return typeof intent === 'string' && STUCK_INTENTS.has(intent);
}
