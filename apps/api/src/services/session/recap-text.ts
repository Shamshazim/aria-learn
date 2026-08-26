import { sentencesOf } from '@/quality/checks/level/readability';
import type { RecapMoment, SessionRecap } from '@/services/session/recap.types';

const MAX_SENTENCES = 3;
const DIGITS = /\d/u;

/**
 * What gets written down about a session, in words a grown-up could read back (P2H-11).
 *
 * Aria's own ending is preferred when she made one: it is the sentence the child actually
 * heard, so the record and the room agree. A session that stopped without an ending — a closed
 * tab, a timeout — still gets a summary, built from the recap rather than left null, because
 * an empty row reads as "nothing happened" and something did.
 */
export function sessionSummary(
  input: Readonly<{ endText: string | null; recap: SessionRecap; subject: string }>,
): string {
  const spoken = input.endText?.trim() ?? '';
  if (spoken !== '' && isRecordable(spoken)) return spoken;
  return recapSummary(input.recap, input.subject);
}

/** §14: a session is never written down as a score, so the summary carries no digits either. */
function isRecordable(text: string): boolean {
  return !DIGITS.test(text) && sentencesOf(text).length <= MAX_SENTENCES;
}

const MOMENT_SENTENCE: Readonly<Record<RecapMoment['kind'], string>> = {
  'after-reteach': 'We looked at one idea a second way and then it went in.',
  persistence: 'You kept going after some tricky ones.',
  'first-correct': 'You worked some of them out on your own.',
};

function recapSummary(recap: SessionRecap, subject: string): string {
  const opening = `We worked on ${subject} today.`;
  if (recap.attempted === 0) return `${opening} We made a start and stopped there.`;
  const moment = recap.moment === null ? null : MOMENT_SENTENCE[recap.moment.kind];
  return moment === null ? `${opening} You had a go at every question.` : `${opening} ${moment}`;
}
