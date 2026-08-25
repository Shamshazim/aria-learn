import { scrubLearnerContext, type ScrubbedContext } from '@/privacy';
import type { RelevantFact } from '@/services/memory/relevance/rules';

export function toScrubbedContext(
  input: Readonly<{
    band: string;
    skillCode: string | null;
    facts: readonly RelevantFact[];
    recentEvidence?: readonly string[];
    identifiers: Readonly<{
      fullName?: string;
      parentEmail?: string;
      school?: string;
      address?: string;
      phone?: string;
      exactBirthdate?: string;
    }>;
  }>,
): ScrubbedContext {
  return scrubLearnerContext(
    {
      gradeBand: input.band,
      identifiers: input.identifiers,
      ...(input.skillCode === null ? {} : { skill: input.skillCode }),
      learnerMemory: input.facts.map((item) => ({
        category: item.fact.kind,
        modelShareable: item.fact.modelShareable,
        text: item.text,
      })),
      ...(input.recentEvidence === undefined ? {} : { recentEvidence: input.recentEvidence }),
    },
    { pseudonym: 'omit' },
  );
}
