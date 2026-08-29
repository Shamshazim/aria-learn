import type { Band, TutorInputEvent } from '@aria/shared';

/**
 * How long a turn may wait for judgement, per band (P2H-06).
 *
 * The numbers come from what a child of that age will sit through before the pause reads as
 * "it broke", not from what the model needs — but they have to be reachable, or the planner
 * never runs and every turn is the policy's canned move. The TEACH endpoint answers a planning
 * prompt in 0.6–1.5 s; the budgets sit above that. On the voice channel they are halved:
 * speech takes its own time at both ends, and the planner runs on a partial transcript there,
 * so the turn has already spent the budget it had.
 */
export const PLANNER_TEXT_BUDGET_MS: Readonly<Record<Band, number>> = {
  early: 2_000,
  middle: 2_500,
  senior: 3_000,
};

const VOICE_EVENTS: ReadonlySet<TutorInputEvent['kind']> = new Set([
  'SPEECH_PARTIAL',
  'SPEECH_FINAL',
  'SPEECH_STARTED',
  'INTERRUPT',
  'BACKCHANNEL',
  'MEDIA_LOST',
  'MEDIA_RESTORED',
]);

export function plannerBudgetMs(band: Band, event: TutorInputEvent): number {
  const budget = PLANNER_TEXT_BUDGET_MS[band];
  return VOICE_EVENTS.has(event.kind) ? Math.round(budget / 2) : budget;
}
