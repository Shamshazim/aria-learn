import { ENGAGEMENT_STATES } from '@aria/shared';

import type { MemoryProposal } from '@/services/memory/propose/from-events';

/**
 * P3-05: engagement is a state of a session, never a fact about a child. "Seemed tired" on a
 * Tuesday becomes "is a tired child" the moment it is remembered, which is exactly the
 * personality-trait-from-one-mood §4.3 forbids — so these kinds are refused outright.
 */
const ENGAGEMENT_KINDS: ReadonlySet<string> = new Set(['engagement', ...ENGAGEMENT_STATES]);

/**
 * A teaching response ("shorter prompts help") is about what works for this child, so it may
 * be kept — but only once the same thing helped in at least three sessions, whatever the
 * service-wide repetition setting says. Observations are written once per consolidated session.
 */
const TEACHING_RESPONSE_SESSIONS = 3;

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
  if (ENGAGEMENT_KINDS.has(input.proposal.kind)) {
    return { kind: 'reject', reason: 'engagement is never remembered' };
  }
  if (input.proposal.temporary) {
    return { kind: 'observation', expiresAt: new Date(input.now.getTime() + 24 * 3_600_000) };
  }
  if (input.proposal.confidence < 0.8) return { kind: 'reject', reason: 'low confidence' };
  const needed =
    input.proposal.kind === 'teaching_response'
      ? Math.max(TEACHING_RESPONSE_SESSIONS, input.repetitionsForDurableFact)
      : input.repetitionsForDurableFact;
  if (input.repeatedCount < needed) {
    return { kind: 'observation', expiresAt: new Date(input.now.getTime() + 7 * 24 * 3_600_000) };
  }
  return { kind: 'fact' };
}
