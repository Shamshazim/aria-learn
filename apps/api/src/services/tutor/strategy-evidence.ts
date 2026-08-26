import { SKILL_STRATEGIES } from '@/services/tutor/strategy-evidence.data';

/**
 * The strategies this answer earns the right to be praised for (P2H-11).
 *
 * A wrong answer earns none: the child may well have regrouped and then slipped, but "you
 * regrouped" said over a wrong answer is a tutor who has stopped reading.
 */
export function strategiesFor(skillCode: string | null, correct: boolean): readonly string[] {
  if (!correct || skillCode === null) return [];
  return SKILL_STRATEGIES[skillCode] ?? [];
}
