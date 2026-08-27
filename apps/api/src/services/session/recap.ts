import type { RecapMoment, RecapSkill, SessionRecap } from '@/services/session/recap.types';
import type { SessionEventRecord } from '@/types/session';

/** The Aria moves that mean the child was taught the idea again before the next attempt. */
const RETEACH_KINDS: ReadonlySet<string> = new Set(['RETEACH', 'REVEAL', 'SHOW']);

/**
 * Reads a session back out of its own events (P2H-11).
 *
 * Deterministic and read-only: the same events always produce the same recap, so an ending
 * generated during the session and a summary written after it cannot disagree about what
 * happened. `skillName` is injected because the inventory is not this module's business.
 */
export function buildRecap(
  records: readonly SessionEventRecord[],
  skillName: (code: string) => string | null,
): SessionRecap {
  const graded = records.filter((record) => record.actor === 'child' && record.correct !== null);
  return {
    skills: skillsTouched(graded, skillName),
    attempted: graded.length,
    correct: graded.filter((record) => record.correct === true).length,
    finalStreak: finalStreak(graded),
    moment: momentOf(records, graded, skillName),
  };
}

function skillsTouched(
  graded: readonly SessionEventRecord[],
  skillName: (code: string) => string | null,
): readonly RecapSkill[] {
  const codes = [
    ...new Set(graded.flatMap((record) => (record.skillCode === null ? [] : [record.skillCode]))),
  ];
  return codes.map((code) => ({ code, name: skillName(code) ?? code }));
}

function finalStreak(graded: readonly SessionEventRecord[]): number {
  let streak = 0;
  for (const record of [...graded].reverse()) {
    if (record.correct !== true) break;
    streak += 1;
  }
  return streak;
}

/**
 * The one moment worth naming, in the order that makes the better ending.
 *
 * A correct answer straight after being taught the idea again beats a correct answer after two
 * wrong tries, which beats the first correct answer of the day — because the first is the one a
 * child would not have got when they walked in.
 */
function momentOf(
  records: readonly SessionEventRecord[],
  graded: readonly SessionEventRecord[],
  skillName: (code: string) => string | null,
): RecapMoment | null {
  const afterReteach = graded.find(
    (record) => record.correct === true && wasRetaught(records, record),
  );
  if (afterReteach !== undefined) return moment('after-reteach', afterReteach, skillName);
  const persisted = graded.find(
    (record) => record.correct === true && wrongBefore(graded, record) >= 2,
  );
  if (persisted !== undefined) return moment('persistence', persisted, skillName);
  const first = graded.find((record) => record.correct === true);
  return first === undefined ? null : moment('first-correct', first, skillName);
}

function moment(
  kind: RecapMoment['kind'],
  record: SessionEventRecord,
  skillName: (code: string) => string | null,
): RecapMoment | null {
  if (record.skillCode === null) return null;
  return {
    kind,
    skillCode: record.skillCode,
    skillName: skillName(record.skillCode) ?? record.skillCode,
  };
}

/** Was the idea explained again between this answer and the one before it? */
function wasRetaught(records: readonly SessionEventRecord[], answer: SessionEventRecord): boolean {
  const before = records.filter((record) => record.seq < answer.seq);
  const previousAnswer = [...before].reverse().find((record) => record.correct !== null);
  const since = before.filter((record) => record.seq > (previousAnswer?.seq ?? -1));
  return since.some((record) => record.actor === 'aria' && RETEACH_KINDS.has(record.kind));
}

function wrongBefore(graded: readonly SessionEventRecord[], answer: SessionEventRecord): number {
  return graded.filter(
    (record) =>
      record.seq < answer.seq && record.correct === false && record.skillCode === answer.skillCode,
  ).length;
}
