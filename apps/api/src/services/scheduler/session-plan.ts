import { z } from 'zod';

import type { PlanStep, SessionPlan } from '@aria/tutor';

const stepSchema = z.object({
  skillCode: z.string().min(1),
  mode: z.enum(['retrieve', 'teach', 'practice', 'read-aloud', 'count-aloud']),
  maxItems: z.number().int().positive(),
});

/** What the scheduler adds to `session.plan`, beside the `skillCode` the session is on. */
export function planFields(plan: SessionPlan): Readonly<Record<string, unknown>> {
  return { steps: plan.steps, goalIndirect: plan.goalIndirect };
}

/**
 * The steps stored on a session, or none. Parsed, not trusted: a session created before P3-04
 * has no steps, and a malformed value is treated the same way rather than failing a turn.
 */
export function readPlanSteps(plan: Readonly<Record<string, unknown>>): readonly PlanStep[] {
  const parsed = z.array(stepSchema).safeParse(plan.steps);
  return parsed.success ? parsed.data : [];
}

/**
 * The next different skill in the plan after the one the session is on: where a finished
 * topic goes. Position comes from the session's current skill — the last move recorded —
 * so a resumed session carries on from where it was rather than rebuilding the plan.
 */
export function nextPlannedSkill(steps: readonly PlanStep[], current: string): string | null {
  const at = steps.findIndex((step) => step.skillCode === current);
  if (at < 0) return null;
  return steps.slice(at + 1).find((step) => step.skillCode !== current)?.skillCode ?? null;
}
