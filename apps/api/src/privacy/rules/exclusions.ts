import type { RawLearnerMemory } from '@/privacy/types';

export function excludeParentRestrictedFacts(
  facts: readonly RawLearnerMemory[],
): readonly RawLearnerMemory[] {
  return facts.filter((fact) => fact.modelShareable);
}
