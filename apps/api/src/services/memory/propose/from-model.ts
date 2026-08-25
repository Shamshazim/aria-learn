import type { AiClient } from '@/ai';
import type { ScrubbedContext } from '@/privacy';
import { containsSensitiveDisclosure } from '@/safety';
import type { MemoryProposal } from '@/services/memory/propose/from-events';

export type ModelFactProposer = Readonly<{
  propose(
    input: Readonly<{ context: ScrubbedContext; eventIds: readonly string[] }>,
  ): Promise<readonly MemoryProposal[]>;
}>;

export function proposeFromModel(
  port: ModelFactProposer,
  input: Readonly<{ context: ScrubbedContext; eventIds: readonly string[] }>,
): Promise<readonly MemoryProposal[]> {
  return port.propose(input);
}

export function createModelFactProposer(ai: AiClient): ModelFactProposer {
  const allowedKinds = new Set([
    'goal',
    'preference',
    'teaching_response',
    'practice_persistence',
    'mood',
  ]);
  return {
    propose: async (input) => {
      const allowed = new Set(input.eventIds);
      const result = await ai.run('memory-proposals', input);
      return result.data.proposals
        .filter(
          (proposal) => allowed.has(proposal.sourceEventId) && allowedKinds.has(proposal.kind),
        )
        .map((proposal) => ({
          ...proposal,
          sensitive: containsSensitiveDisclosure(proposal.text),
        }));
    },
  };
}
