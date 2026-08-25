import type { LearnerFact } from '@/types/memory';

const KIND_PRIORITY: Readonly<Record<string, number>> = {
  teaching_response: 4,
  goal: 3,
  preference: 2,
  practice_persistence: 1,
};
const GLOBAL_KINDS = new Set(['goal', 'preference']);

export type RelevantFact = Readonly<{ fact: LearnerFact; priority: number; text: string }>;

export function rankRelevantFacts(
  facts: readonly LearnerFact[],
  input: Readonly<{ skillCode: string | null; now: Date }>,
): readonly RelevantFact[] {
  return facts
    .filter((fact) => eligible(fact, input.now))
    .map((fact) => ({ fact, priority: score(fact, input.skillCode), text: presentValue(fact) }))
    .filter((item) => item.priority > 0 && item.text.length > 0)
    .sort(
      (left, right) =>
        right.priority - left.priority ||
        right.fact.lastConfirmedAt.getTime() - left.fact.lastConfirmedAt.getTime() ||
        left.fact.id.localeCompare(right.fact.id),
    );
}

function eligible(fact: LearnerFact, now: Date): boolean {
  return (
    fact.modelShareable &&
    fact.supersededBy === null &&
    (fact.expiresAt === null || fact.expiresAt.getTime() > now.getTime())
  );
}

function score(fact: LearnerFact, skillCode: string | null): number {
  const factSkill = typeof fact.value.skillCode === 'string' ? fact.value.skillCode : null;
  if (factSkill !== null && factSkill !== skillCode) return 0;
  if (factSkill === null && !GLOBAL_KINDS.has(fact.kind)) return 0;
  const skillScore = skillCode !== null && factSkill === skillCode ? 10 : 0;
  return skillScore + (KIND_PRIORITY[fact.kind] ?? 0) + Math.round(fact.confidence * 3);
}

function presentValue(fact: LearnerFact): string {
  const value = fact.value.text;
  return typeof value === 'string' ? value.trim() : '';
}
