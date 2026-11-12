import { foldForMatching, type SelfCorrection } from '@aria/tutor';

import type { LearnerFact } from '@/types/memory';

import type { CorrectionRequest } from './types';

/**
 * Which remembered fact a child's self-correction is about (P3-06), and what to do to it.
 *
 * "I don't like trucks anymore" retracts a current `preference` that mentions trucks; "my dog
 * is called Rex now" replaces the `relationship` fact about the dog. Matching is by the words
 * the fact itself uses, so a claim about something Aria never remembered changes nothing —
 * the child still gets their one-sentence acknowledgement, and the miss is logged so the
 * pattern list can be reviewed. A grade is never changed from here.
 */
export function childCorrectionRequest(
  correction: SelfCorrection,
  current: readonly LearnerFact[],
): CorrectionRequest | null {
  if (correction.kind === 'grade') return null;
  if (correction.kind === 'stopped_liking') {
    const fact = current.find(
      (candidate) => candidate.kind === 'preference' && mentions(candidate, correction.thing),
    );
    return fact === undefined ? null : { targetKind: 'fact', targetId: fact.id, action: 'retract' };
  }
  const fact = current.find(
    (candidate) => candidate.kind === 'relationship' && mentions(candidate, correction.relation),
  );
  if (fact === undefined) return null;
  return {
    targetKind: 'fact',
    targetId: fact.id,
    action: 'replace',
    newValue: { text: `Their ${correction.relation} is called ${correction.name}.` },
  };
}

/** The self-correction a committed turn carried, read back from its plan evidence. */
export function selfCorrectionFrom(
  evidence: Readonly<Record<string, unknown>>,
): SelfCorrection | null {
  const text = (key: string): string | null => {
    const value = evidence[key];
    return typeof value === 'string' && value !== '' ? value : null;
  };
  const thing = text('selfCorrectionThing');
  const relation = text('selfCorrectionRelation');
  const name = text('selfCorrectionName');
  const grade = text('selfCorrectionGrade');
  switch (evidence.selfCorrection) {
    case 'stopped_liking':
      return thing === null ? null : { kind: 'stopped_liking', thing };
    case 'renamed':
      return relation === null || name === null ? null : { kind: 'renamed', relation, name };
    case 'grade':
      return grade === null ? null : { kind: 'grade', grade };
    default:
      return null;
  }
}

/** Whole-word, case- and accent-insensitive: "trucks" matches "Loves monster trucks". */
function mentions(fact: LearnerFact, words: string): boolean {
  const text = typeof fact.value.text === 'string' ? fact.value.text : '';
  const haystack = ` ${foldForMatching(text)
    .toLowerCase()
    .replace(/[^a-z0-9' ]+/gu, ' ')} `;
  const needle = foldForMatching(words).toLowerCase().trim();
  return needle !== '' && haystack.includes(` ${needle} `);
}
