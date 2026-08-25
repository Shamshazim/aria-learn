import type { Band, TutorInputEvent } from '@aria/shared';

/**
 * How long a turn may wait for judgement, per band (P2H-06).
 *
 * The numbers come from what a child of that age will sit through before the pause reads as
 * "it broke", not from what the model needs. On the voice channel they are halved: speech
 * takes its own time at both ends, and the planner runs on a partial transcript there, so the
 * turn has already spent the budget it had.
 */
const TEXT_BUDGET_MS: Readonly<Record<Band, number>> = {
  early: 700,
  middle: 900,
  senior: 1_200,
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
  const budget = TEXT_BUDGET_MS[band];
  return VOICE_EVENTS.has(event.kind) ? Math.round(budget / 2) : budget;
}

export { TEXT_BUDGET_MS as PLANNER_TEXT_BUDGET_MS };
