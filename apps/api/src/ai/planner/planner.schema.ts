import { z } from 'zod';

import { MOVE_KINDS } from '@aria/shared';

import type { PlanMovePromptOutput } from '@/ai/prompts/types';

const MAX_RATIONALE_LENGTH = 200;
const MAX_APPROACH_LENGTH = 40;

/**
 * What the planner is allowed to say back (P2H-06).
 *
 * The approach is a bounded string here rather than an enum, on purpose: an approach the
 * planner invented has to survive parsing so the turn can *reject* it and count the rejection.
 * A parse failure would look like an outage instead of a bad proposal.
 */
export const plannerProposalSchema: z.ZodType<PlanMovePromptOutput> = z
  .object({
    kind: z.enum(MOVE_KINDS),
    approach: z.string().trim().min(1).max(MAX_APPROACH_LENGTH),
    rationale: z.string().trim().min(1).max(MAX_RATIONALE_LENGTH),
    confidence: z.number().min(0).max(1),
  })
  .strict();
