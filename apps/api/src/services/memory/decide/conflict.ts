import type { LearnerFact } from '@/types/memory';

export function conflictingFact(
  current: readonly LearnerFact[],
  kind: string,
  text: string,
  skillCode: string | null,
): LearnerFact | null {
  return (
    current.find(
      (fact) =>
        fact.kind === kind &&
        (typeof fact.value.skillCode === 'string' ? fact.value.skillCode : null) === skillCode &&
        fact.value.text !== text,
    ) ?? null
  );
}
