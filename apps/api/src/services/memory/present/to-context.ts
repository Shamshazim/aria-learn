import { scrubLearnerContext, type RawDialogueTurn, type ScrubbedContext } from '@/privacy';
import { firstNameOf } from '@/privacy/rules/identifiers';
import type { RelevantFact } from '@/services/memory/relevance/rules';

export function toScrubbedContext(
  input: Readonly<{
    band: string;
    skillCode: string | null;
    facts: readonly RelevantFact[];
    recentEvidence?: readonly string[];
    recentDialogue?: readonly RawDialogueTurn[];
    /** P2H-04: share the child's first name (and only that) with the model. */
    shareFirstName?: boolean;
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
  const firstName =
    input.shareFirstName === true ? firstNameOf(input.identifiers.fullName) : undefined;
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
      ...(input.recentDialogue === undefined ? {} : { recentDialogue: input.recentDialogue }),
      ...(firstName === undefined ? {} : { pseudonymousFirstName: firstName }),
    },
    { pseudonym: firstName === undefined ? 'omit' : 'include' },
  );
}
