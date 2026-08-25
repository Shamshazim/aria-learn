import type { MemoryProposal } from '@/services/memory/propose/from-events';

export type ProposalDecision =
  | Readonly<{ kind: 'reject'; reason: string }>
  | Readonly<{ kind: 'observation'; expiresAt: Date }>
  | Readonly<{ kind: 'fact' }>;

export function decideProposal(
  input: Readonly<{
    proposal: MemoryProposal;
    repeatedCount: number;
    repetitionsForDurableFact: number;
    now: Date;
  }>,
): ProposalDecision {
  if (input.proposal.sensitive) return { kind: 'reject', reason: 'sensitive disclosure' };
  if (input.proposal.temporary) {
    return { kind: 'observation', expiresAt: new Date(input.now.getTime() + 24 * 3_600_000) };
  }
  if (input.proposal.confidence < 0.8) return { kind: 'reject', reason: 'low confidence' };
  if (input.repeatedCount < input.repetitionsForDurableFact) {
    return { kind: 'observation', expiresAt: new Date(input.now.getTime() + 7 * 24 * 3_600_000) };
  }
  return { kind: 'fact' };
}
